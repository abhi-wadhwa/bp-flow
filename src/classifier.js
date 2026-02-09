import { RESPONSE_KEYWORDS, MECHANISM_KEYWORDS, IMPACT_KEYWORDS } from './constants';

// Fuzzy token overlap similarity
function tokenSimilarity(a, b) {
  const tokensA = a.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const tokensB = b.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setB = new Set(tokensB);
  const overlap = tokensA.filter(t => setB.has(t)).length;
  return overlap / Math.max(tokensA.length, tokensB.length);
}

// Detect which part of an argument is being rebutted
function detectRebuttalTarget(text) {
  const lower = text.toLowerCase();

  // Check mechanism keywords first (more specific)
  if (MECHANISM_KEYWORDS.some(kw => lower.includes(kw))) {
    return 'mechanism';
  }

  // Check impact keywords
  if (IMPACT_KEYWORDS.some(kw => lower.includes(kw))) {
    return 'impact';
  }

  // Check for generic claim rebuttal (e.g., "not true", "factually wrong")
  const claimKeywords = ['not true', 'untrue', 'false', 'wrong', 'incorrect', 'mischaracteriz', 'lie', 'fabricat'];
  if (claimKeywords.some(kw => lower.includes(kw))) {
    return 'claim';
  }

  return null;
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
      const sim = tokenSimilarity(text, arg.claim || arg.text);
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
      const sim = tokenSimilarity(text, arg.claim || arg.text);
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

  // Detect rebuttal target
  const rebuttal_target = hasResponseIndicator ? detectRebuttalTarget(text) : null;

  const confidence = hasResponseIndicator && respondsTo ? 0.5 : 0.3;

  return {
    clash_theme: clashTheme,
    is_new_theme: !clashTheme,
    responds_to: respondsTo,
    rebuttal_target,
    confidence,
    source: 'heuristic',
  };
}

// Groq API classification
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
console.log('[classifier] GROQ_API_KEY loaded:', GROQ_API_KEY ? 'yes (' + GROQ_API_KEY.slice(0, 8) + '...)' : 'NO - missing');

async function groqClassify(text, speaker, team, speechNumber, existingArgs, existingThemes) {
  const argsSummary = existingArgs.slice(-20).map(a => ({
    id: a.id,
    text: a.claim || a.text,
    mechanisms: a.mechanisms || (a.mechanism ? [a.mechanism] : []),
    impacts: a.impacts || (a.impact ? [a.impact] : []),
    refutations: a.refutations || [],
    speaker: a.speaker,
    team: a.team,
    theme: a.clashTheme,
  }));

  const hasContext = existingArgs.length > 0;
  const hasThemes = existingThemes.length > 0;

  const systemPrompt = `You are a classifier for British Parliamentary (BP) debate arguments. Your job is to organize arguments into "clashes" (topic areas), identify which previous argument a new argument responds to, and determine which PART of the argument is being rebutted.

In BP debate, arguments have structure:
- CLAIM: The assertion being made (e.g., "Free trade helps developing nations")
- MECHANISM: Why/how it works (e.g., "Because it lowers tariffs, enabling cheaper imports")
- IMPACT: What happens as a result (e.g., "Leading to GDP growth and poverty reduction")

When a speaker rebuts, they may attack different parts:
- Attacking the MECHANISM: "The link breaks because tariff reduction doesn't help countries without export capacity" — this challenges WHY the claim works
- Attacking the IMPACT: "Even if trade increases, the gains are marginal and don't reduce poverty" — this accepts the mechanism but minimizes the consequence
- Attacking the CLAIM: "This is factually wrong, free trade has historically hurt developing nations" — this disputes the core assertion itself

RULES:
- clash_theme: A short label (2-5 words) for the topic area. ${hasThemes ? 'Reuse an existing theme if the argument fits.' : 'Create a new descriptive theme name.'} Examples: "Economic Impact", "Rights of Minorities", "Practical Implementation".
- is_new_theme: true only if this argument introduces a genuinely new topic not covered by existing themes.
- responds_to: The "id" of a SPECIFIC previous argument this directly responds to, rebuts, or extends. Use null if it's a standalone new point. Only use IDs that exist in the provided arguments list.
- rebuttal_target: Which part of the target argument is being attacked: "claim", "mechanism", "impact", or null if not a rebuttal. Only set this when responds_to is non-null.
- confidence: How confident you are in the classification (0.0-1.0). Use 0.7+ when the link/theme is clear, 0.3-0.6 when uncertain.

You MUST respond with valid JSON only. No markdown, no explanation.`;

  let userPrompt = `NEW ARGUMENT: "${text}"
Speaker: ${speaker} (${team}), Speech #${speechNumber}`;

  if (hasThemes) {
    userPrompt += `\n\nEXISTING THEMES: ${JSON.stringify(existingThemes)}`;
  }

  if (hasContext) {
    userPrompt += `\n\nRECENT ARGUMENTS:\n${argsSummary.map(a => {
      let line = `[id=${a.id}] ${a.speaker} (${a.team}): CLAIM: "${a.text}"`;
      if (a.mechanisms.length) line += ` | MECH: ${a.mechanisms.map(m => `"${m}"`).join(', ')}`;
      if (a.impacts.length) line += ` | IMPACT: ${a.impacts.map(m => `"${m}"`).join(', ')}`;
      if (a.refutations.length) line += ` | REFUT: ${a.refutations.map(r => `"${r}"`).join(', ')}`;
      if (a.theme) line += ` [theme: ${a.theme}]`;
      return line;
    }).join('\n')}`;
  }

  userPrompt += `\n\nClassify this argument. Respond with: {"clash_theme": "string", "is_new_theme": boolean, "responds_to": "id_string_or_null", "rebuttal_target": "claim"|"mechanism"|"impact"|null, "confidence": number}`;

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
      max_completion_tokens: 200,
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

  // Strip markdown backticks if present
  const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    const result = JSON.parse(cleaned);

    // Validate responds_to references an actual argument
    if (result.responds_to) {
      const validId = existingArgs.some(a => a.id === String(result.responds_to));
      if (!validId) {
        result.responds_to = null;
        result.rebuttal_target = null;
        result.confidence = Math.min(result.confidence || 0.5, 0.4);
      } else {
        result.responds_to = String(result.responds_to);
      }
    }

    // Validate rebuttal_target
    const validTargets = ['claim', 'mechanism', 'impact', null];
    if (!validTargets.includes(result.rebuttal_target)) {
      result.rebuttal_target = null;
    }

    // rebuttal_target only makes sense if responds_to is set
    if (!result.responds_to) {
      result.rebuttal_target = null;
    }

    return { ...result, source: 'groq' };
  } catch (e) {
    console.warn('Groq response parse error:', rawText, e);
    return heuristicClassify(text, existingArgs, existingThemes);
  }
}

export async function classifyArgument(text, speaker, team, speechNumber, existingArgs, existingThemes) {
  console.log('[classifier] classifyArgument called, GROQ_API_KEY present:', !!GROQ_API_KEY);
  if (GROQ_API_KEY) {
    try {
      console.log('[classifier] Calling Groq API...');
      const result = await groqClassify(text, speaker, team, speechNumber, existingArgs, existingThemes);
      console.log('[classifier] Groq result:', result);
      return result;
    } catch (e) {
      console.warn('[classifier] Groq failed, falling back to heuristic:', e.message);
      return heuristicClassify(text, existingArgs, existingThemes);
    }
  }
  console.log('[classifier] No API key, using heuristic');
  return heuristicClassify(text, existingArgs, existingThemes);
}
