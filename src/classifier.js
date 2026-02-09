import { RESPONSE_KEYWORDS } from './constants';

// Fuzzy token overlap similarity
function tokenSimilarity(a, b) {
  const tokensA = a.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const tokensB = b.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setB = new Set(tokensB);
  const overlap = tokensA.filter(t => setB.has(t)).length;
  return overlap / Math.max(tokensA.length, tokensB.length);
}

// Client-side heuristic classification
export function heuristicClassify(text, existingArgs, existingThemes) {
  const lower = text.toLowerCase();

  // Check for response indicators
  const hasResponseIndicator = RESPONSE_KEYWORDS.some(kw => lower.includes(kw));

  let respondsTo = null;
  let bestSimilarity = 0;

  if (hasResponseIndicator && existingArgs.length > 0) {
    for (const arg of existingArgs) {
      const sim = tokenSimilarity(text, arg.text);
      if (sim > bestSimilarity && sim > 0.15) {
        bestSimilarity = sim;
        respondsTo = arg.id;
      }
    }
  }

  // Find best matching theme
  let clashTheme = null;
  let bestThemeSim = 0;

  for (const theme of existingThemes) {
    const sim = tokenSimilarity(text, theme);
    if (sim > bestThemeSim && sim > 0.2) {
      bestThemeSim = sim;
      clashTheme = theme;
    }
  }

  // Also check similarity with args in each theme
  if (!clashTheme) {
    const themeScores = {};
    for (const arg of existingArgs) {
      if (!arg.clashTheme) continue;
      const sim = tokenSimilarity(text, arg.text);
      themeScores[arg.clashTheme] = (themeScores[arg.clashTheme] || 0) + sim;
    }
    let best = 0;
    for (const [theme, score] of Object.entries(themeScores)) {
      if (score > best) {
        best = score;
        clashTheme = theme;
      }
    }
    if (best < 0.1) clashTheme = null;
  }

  const confidence = hasResponseIndicator && respondsTo ? 0.5 : 0.3;

  return {
    clash_theme: clashTheme,
    is_new_theme: !clashTheme,
    responds_to: respondsTo,
    confidence,
    source: 'heuristic',
  };
}

// Groq API classification
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

async function groqClassify(text, speaker, team, speechNumber, existingArgs, existingThemes) {
  const argsSummary = existingArgs.slice(-20).map(a => ({
    id: a.id,
    text: a.text,
    speaker: a.speaker,
    team: a.team,
    theme: a.clashTheme,
  }));

  const systemPrompt = `You are a British Parliamentary debate argument classifier. Given a new argument and the context of existing arguments, classify it. Respond ONLY with valid JSON, no markdown or explanation.

Respond with: {"clash_theme": "string", "is_new_theme": boolean, "responds_to": "argument_id or null", "confidence": 0.0-1.0}`;

  const userPrompt = `New argument: "${text}" (by ${speaker}, ${team}, speech ${speechNumber})

Existing clash themes: ${JSON.stringify(existingThemes)}
Existing arguments: ${JSON.stringify(argsSummary)}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_completion_tokens: 100,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content || '';

  // Strip markdown backticks if present
  const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    const result = JSON.parse(cleaned);
    return { ...result, source: 'groq' };
  } catch {
    return heuristicClassify(text, existingArgs, existingThemes);
  }
}

export async function classifyArgument(text, speaker, team, speechNumber, existingArgs, existingThemes) {
  if (GROQ_API_KEY) {
    try {
      return await groqClassify(text, speaker, team, speechNumber, existingArgs, existingThemes);
    } catch {
      return heuristicClassify(text, existingArgs, existingThemes);
    }
  }
  return heuristicClassify(text, existingArgs, existingThemes);
}
