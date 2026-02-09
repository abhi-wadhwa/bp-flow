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

  const hasContext = existingArgs.length > 0;
  const hasThemes = existingThemes.length > 0;

  const systemPrompt = `You are a classifier for British Parliamentary (BP) debate arguments. Your job is to organize arguments into "clashes" (topic areas) and identify which previous argument a new argument responds to.

RULES:
- clash_theme: A short label (2-5 words) for the topic area. ${hasThemes ? 'Reuse an existing theme if the argument fits.' : 'Create a new descriptive theme name.'} Examples: "Economic Impact", "Rights of Minorities", "Practical Implementation".
- is_new_theme: true only if this argument introduces a genuinely new topic not covered by existing themes.
- responds_to: The "id" of a SPECIFIC previous argument this directly responds to, rebuts, or extends. Use null if it's a standalone new point. Only use IDs that exist in the provided arguments list.
- confidence: How confident you are in the classification (0.0-1.0). Use 0.7+ when the link/theme is clear, 0.3-0.6 when uncertain.

You MUST respond with valid JSON only. No markdown, no explanation.`;

  let userPrompt = `NEW ARGUMENT: "${text}"
Speaker: ${speaker} (${team}), Speech #${speechNumber}`;

  if (hasThemes) {
    userPrompt += `\n\nEXISTING THEMES: ${JSON.stringify(existingThemes)}`;
  }

  if (hasContext) {
    userPrompt += `\n\nRECENT ARGUMENTS:\n${argsSummary.map(a =>
      `[id=${a.id}] ${a.speaker} (${a.team}): "${a.text}"${a.theme ? ` [theme: ${a.theme}]` : ''}`
    ).join('\n')}`;
  }

  userPrompt += `\n\nClassify this argument. Respond with: {"clash_theme": "string", "is_new_theme": boolean, "responds_to": "id_string_or_null", "confidence": number}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_completion_tokens: 150,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    console.warn(`Groq API error ${response.status}:`, errBody);
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content || '';

  // Strip markdown backticks if present (shouldn't happen with json_object mode)
  const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    const result = JSON.parse(cleaned);

    // Validate responds_to references an actual argument
    if (result.responds_to) {
      const validId = existingArgs.some(a => a.id === String(result.responds_to));
      if (!validId) {
        result.responds_to = null;
        result.confidence = Math.min(result.confidence || 0.5, 0.4);
      } else {
        result.responds_to = String(result.responds_to);
      }
    }

    return { ...result, source: 'groq' };
  } catch (e) {
    console.warn('Groq response parse error:', rawText, e);
    return heuristicClassify(text, existingArgs, existingThemes);
  }
}

export async function classifyArgument(text, speaker, team, speechNumber, existingArgs, existingThemes) {
  if (GROQ_API_KEY) {
    try {
      return await groqClassify(text, speaker, team, speechNumber, existingArgs, existingThemes);
    } catch (e) {
      console.warn('Classification fell back to heuristic:', e.message);
      return heuristicClassify(text, existingArgs, existingThemes);
    }
  }
  return heuristicClassify(text, existingArgs, existingThemes);
}
