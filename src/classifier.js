import {
  RESPONSE_KEYWORDS, MECHANISM_KEYWORDS, IMPACT_KEYWORDS,
  MECHANISM_INDICATOR_KEYWORDS, IMPACT_INDICATOR_KEYWORDS,
} from './constants';

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

  if (MECHANISM_KEYWORDS.some(kw => lower.includes(kw))) {
    return 'mechanism';
  }

  if (IMPACT_KEYWORDS.some(kw => lower.includes(kw))) {
    return 'impact';
  }

  const claimKeywords = ['not true', 'untrue', 'false', 'wrong', 'incorrect', 'mischaracteriz', 'lie', 'fabricat'];
  if (claimKeywords.some(kw => lower.includes(kw))) {
    return 'claim';
  }

  return null;
}

// Find most recent same-team claim for belongs_to
function findSameTeamClaim(existingArgs, currentTeam) {
  for (let i = existingArgs.length - 1; i >= 0; i--) {
    const a = existingArgs[i];
    if (a.team === currentTeam && !a.isJudgeNote && !a.isPOI) {
      return a.id;
    }
  }
  return null;
}

// Find best opposing-team target for refutation
function findOpposingTarget(text, existingArgs, currentTeam) {
  let bestId = null;
  let bestSim = 0;

  for (const arg of existingArgs) {
    if (arg.team === currentTeam || arg.isJudgeNote) continue;
    const sim = tokenSimilarity(text, arg.claim || arg.text);
    if (sim > bestSim && sim > 0.15) {
      bestSim = sim;
      bestId = arg.id;
    }
  }

  return bestId;
}

// Client-side heuristic classification
export function heuristicClassify(text, existingArgs, existingThemes, currentTeam) {
  const lower = text.toLowerCase();

  // Detect argument type
  const hasResponseIndicator = RESPONSE_KEYWORDS.some(kw => lower.includes(kw));
  const hasMechanismIndicator = MECHANISM_INDICATOR_KEYWORDS.some(kw => lower.includes(kw));
  const hasImpactIndicator = IMPACT_INDICATOR_KEYWORDS.some(kw => lower.includes(kw));

  let argument_type = 'claim';
  let belongs_to = null;
  let responds_to = null;
  let rebuttal_target = null;

  if (hasResponseIndicator) {
    argument_type = 'refutation';
    responds_to = findOpposingTarget(text, existingArgs, currentTeam);
    rebuttal_target = detectRebuttalTarget(text);
  } else if (hasMechanismIndicator) {
    argument_type = 'mechanism';
    belongs_to = findSameTeamClaim(existingArgs, currentTeam);
  } else if (hasImpactIndicator) {
    argument_type = 'impact';
    belongs_to = findSameTeamClaim(existingArgs, currentTeam);
  }

  // Find best matching theme (for claims and refutations)
  let clashTheme = null;
  let bestThemeSim = 0;

  for (const theme of existingThemes) {
    const sim = tokenSimilarity(text, theme);
    if (sim > bestThemeSim && sim > 0.2) {
      bestThemeSim = sim;
      clashTheme = theme;
    }
  }

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

  // For mechanism/impact, inherit theme from parent arg
  if ((argument_type === 'mechanism' || argument_type === 'impact') && belongs_to && !clashTheme) {
    const parentArg = existingArgs.find(a => a.id === belongs_to);
    if (parentArg) clashTheme = parentArg.clashTheme;
  }

  const confidence = hasResponseIndicator && responds_to ? 0.5
    : (hasMechanismIndicator || hasImpactIndicator) && belongs_to ? 0.5
    : 0.3;

  return {
    argument_type,
    belongs_to,
    clash_theme: clashTheme,
    is_new_theme: argument_type === 'claim' && !clashTheme,
    responds_to,
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

  const systemPrompt = `You are a classifier for British Parliamentary (BP) debate arguments. Your job is to determine what TYPE of point has been made, where it belongs, and organize arguments into "clashes" (topic areas).

In BP debate, speakers make different types of points:
- CLAIM: A new assertion or argument (e.g., "Free trade helps developing nations")
- MECHANISM: An explanation of WHY/HOW a claim works, supporting an existing claim (e.g., "Because lower tariffs enable cheaper imports")
- IMPACT: A consequence or result of a claim, supporting an existing claim (e.g., "Leading to GDP growth and poverty reduction")
- REFUTATION: A response that attacks an opponent's argument (e.g., "The link breaks because tariff reduction doesn't help countries without export capacity")

CLASSIFICATION RULES:
- argument_type: One of "claim", "mechanism", "impact", "refutation"
  * "claim" = a new standalone assertion or argument
  * "mechanism" = explains WHY/HOW — look for words like "because", "the reason is", "this works by", "since", "due to"
  * "impact" = states WHAT HAPPENS — look for words like "leading to", "resulting in", "this matters because", "the harm is", "the benefit is"
  * "refutation" = attacks an opponent's point — look for words like "but", "however", "against", "response", "even if", "counter"

- belongs_to: The "id" of an existing argument this mechanism/impact attaches to. Must be set when argument_type is "mechanism" or "impact". Should be a same-team argument. Use null for claims and refutations.

- responds_to: The "id" of an opponent's argument being rebutted. Only set when argument_type is "refutation". Use null otherwise.

- rebuttal_target: Which part of the target argument is being attacked: "claim", "mechanism", "impact", or null. Only set when argument_type is "refutation" and responds_to is set.

- clash_theme: A short label (2-5 words) for the topic area. ${hasThemes ? 'Reuse an existing theme if the argument fits.' : 'Create a new descriptive theme name.'} For mechanisms/impacts, inherit the theme from the parent argument.

- is_new_theme: true only if this is a claim introducing a genuinely new topic.

- confidence: How confident you are in the full classification (0.0-1.0). Use 0.7+ when clear, 0.3-0.6 when uncertain.

CONSISTENCY RULES:
- mechanism/impact MUST have belongs_to set to a valid same-team argument id
- refutation MUST have responds_to set to a valid opponent argument id
- claim should have belongs_to: null and responds_to: null
- rebuttal_target only makes sense when responds_to is set

The current speaker is on team "${team}".

You MUST respond with valid JSON only. No markdown, no explanation.`;

  let userPrompt = `NEW POINT: "${text}"
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

  userPrompt += `\n\nClassify this point. Respond with: {"argument_type": "claim"|"mechanism"|"impact"|"refutation", "belongs_to": "id_or_null", "responds_to": "id_or_null", "rebuttal_target": "claim"|"mechanism"|"impact"|null, "clash_theme": "string", "is_new_theme": boolean, "confidence": number}`;

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
      max_completion_tokens: 250,
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

    // Validate argument_type
    const validTypes = ['claim', 'mechanism', 'impact', 'refutation'];
    if (!validTypes.includes(result.argument_type)) {
      result.argument_type = 'claim';
    }

    // Validate belongs_to for mechanism/impact
    if (result.argument_type === 'mechanism' || result.argument_type === 'impact') {
      if (result.belongs_to) {
        const validId = existingArgs.some(a => a.id === String(result.belongs_to));
        if (!validId) {
          // Try to find a same-team arg
          result.belongs_to = findSameTeamClaim(existingArgs, team);
        } else {
          result.belongs_to = String(result.belongs_to);
        }
      } else {
        result.belongs_to = findSameTeamClaim(existingArgs, team);
      }
      result.responds_to = null;
      result.rebuttal_target = null;
    }

    // Validate responds_to for refutation
    if (result.argument_type === 'refutation') {
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
      result.belongs_to = null;

      // Validate rebuttal_target
      const validTargets = ['claim', 'mechanism', 'impact', null];
      if (!validTargets.includes(result.rebuttal_target)) {
        result.rebuttal_target = null;
      }
      if (!result.responds_to) {
        result.rebuttal_target = null;
      }
    }

    // Claims should not have belongs_to or responds_to
    if (result.argument_type === 'claim') {
      result.belongs_to = null;
      result.responds_to = null;
      result.rebuttal_target = null;
    }

    return { ...result, source: 'groq' };
  } catch (e) {
    console.warn('Groq response parse error:', rawText, e);
    return heuristicClassify(text, existingArgs, existingThemes, team);
  }
}

// Detect if input should be deconstructed (extract claim/mechanism/impact structure)
export function shouldDeconstruct(text) {
  if (!GROQ_API_KEY) return false;
  const trimmed = text.trim();
  // Any real sentence (40+ chars) gets deconstructed
  return trimmed.length >= 40;
}

// Deconstruct a speech/paragraph into structured arguments via Groq
export async function deconstructSpeech(text, speaker, team, speechNumber, existingArgs, existingThemes) {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key required for deconstruction');
  }

  const argsSummary = existingArgs.slice(-20).map(a => ({
    id: a.id,
    text: a.claim || a.text,
    speaker: a.speaker,
    team: a.team,
    theme: a.clashTheme,
  }));

  const hasContext = existingArgs.length > 0;
  const hasThemes = existingThemes.length > 0;

  const systemPrompt = `You are a debate flow analyst for British Parliamentary (BP) debate. Your job is to take ANY input — from a single sentence to a full speech — and extract its logical structure into claims, mechanisms, and impacts.

Each argument should have:
- claim: The core assertion, rewritten to be TERSE and clear (max 15 words). Use flowing shorthand — capture the essence, not the exact words. Write like a judge scribbling notes fast.
- mechanisms: Array of strings explaining WHY/HOW the claim works. Each mechanism should be terse (max 15 words). Only include if the text actually provides reasoning for this claim. Look for "because", "since", "the reason is", causal explanations, or any reasoning that explains the link.
- impacts: Array of strings explaining WHAT HAPPENS as a result. Each impact should be terse (max 15 words). Only include if the text actually states consequences. Look for "leading to", "resulting in", "this means", harms, benefits, or outcomes.
- clash_theme: A short label (2-5 words) for the topic area.${hasThemes ? ' Reuse existing themes where appropriate.' : ''}
- is_refutation: true if this point is attacking an opponent's argument.
- responds_to: If is_refutation is true, the "id" of the opponent argument being attacked. null otherwise. Only use IDs from the provided list.
- rebuttal_target: "claim", "mechanism", or "impact" — what part is being attacked. null if not a refutation.

IMPORTANT RULES:
- ALWAYS extract structure. Even a single sentence like "Free trade helps because tariffs lower, leading to GDP growth" should produce: claim="Free trade helps developing nations", mechanisms=["Lower tariffs enable cheaper imports"], impacts=["GDP growth"].
- Be TERSE. Each claim/mechanism/impact should be 5-15 words max. Think judge shorthand, not essay prose.
- Rewrite freely for clarity — don't quote verbatim. Capture the logical structure, not the rhetoric.
- Identify DISTINCT arguments — don't combine unrelated points into one.
- A single paragraph might contain one claim with multiple mechanisms, or multiple separate claims.
- Mechanisms explain causation (WHY/HOW). Impacts explain consequences/harms/benefits (SO WHAT).
- If text discusses the same topic but from two angles, those are two separate arguments.
- Group mechanisms and impacts under their parent claim — don't make them separate arguments.
- If a point ONLY makes an assertion with no reasoning or consequences, return it with empty mechanisms and impacts arrays. That's fine.
- The speaker is on team "${team}".

You MUST respond with valid JSON: {"points": [...]}. No markdown, no explanation.`;

  let userPrompt = `SPEECH TEXT:\n"""${text}"""\n\nSpeaker: ${speaker} (${team}), Speech #${speechNumber}`;

  if (hasThemes) {
    userPrompt += `\n\nEXISTING THEMES: ${JSON.stringify(existingThemes)}`;
  }

  if (hasContext) {
    userPrompt += `\n\nEXISTING ARGUMENTS (for responds_to references):\n${argsSummary.map(a => {
      let line = `[id=${a.id}] ${a.speaker} (${a.team}): "${a.text}"`;
      if (a.theme) line += ` [theme: ${a.theme}]`;
      return line;
    }).join('\n')}`;
  }

  userPrompt += `\n\nDeconstruct this speech into structured arguments. Respond with: {"points": [{"claim": "string", "mechanisms": ["string"], "impacts": ["string"], "clash_theme": "string", "is_refutation": boolean, "responds_to": "id_or_null", "rebuttal_target": "claim"|"mechanism"|"impact"|null}]}`;

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
      temperature: 0.15,
      max_completion_tokens: 2000,
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
  const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    const result = JSON.parse(cleaned);
    const points = Array.isArray(result.points) ? result.points : [];

    // Validate and clean each point
    return points.map(p => {
      const point = {
        claim: String(p.claim || '').slice(0, 200),
        mechanisms: Array.isArray(p.mechanisms) ? p.mechanisms.map(m => String(m).slice(0, 200)) : [],
        impacts: Array.isArray(p.impacts) ? p.impacts.map(m => String(m).slice(0, 200)) : [],
        clash_theme: p.clash_theme || null,
        is_refutation: !!p.is_refutation,
        responds_to: null,
        rebuttal_target: null,
      };

      if (point.is_refutation && p.responds_to) {
        const validId = existingArgs.some(a => a.id === String(p.responds_to));
        if (validId) {
          point.responds_to = String(p.responds_to);
          const validTargets = ['claim', 'mechanism', 'impact'];
          point.rebuttal_target = validTargets.includes(p.rebuttal_target) ? p.rebuttal_target : null;
        }
      }

      return point;
    }).filter(p => p.claim.trim().length > 0);
  } catch (e) {
    console.warn('Groq deconstruct parse error:', rawText, e);
    throw new Error('Failed to parse deconstruction result');
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
      return heuristicClassify(text, existingArgs, existingThemes, team);
    }
  }
  console.log('[classifier] No API key, using heuristic');
  return heuristicClassify(text, existingArgs, existingThemes, team);
}
