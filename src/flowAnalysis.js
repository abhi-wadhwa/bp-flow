import { FULL_ROUND_SPEAKERS } from './constants';

export const GOV_TEAMS = new Set(['OG', 'CG']);
export const OPP_TEAMS = new Set(['OO', 'CO']);

// Map each speaker role to its speech order
const SPEECH_ORDER = {};
for (const sp of FULL_ROUND_SPEAKERS) {
  SPEECH_ORDER[sp.role] = sp.order;
}

function getSide(team) {
  if (GOV_TEAMS.has(team)) return 'gov';
  if (OPP_TEAMS.has(team)) return 'opp';
  return null;
}

/**
 * Compute genuinely dropped argument IDs.
 * An argument is "dropped" only if:
 *   1. It's a real substantive point (not a POI, weighing note, extension marker, or judge note)
 *   2. The opposing side had at least one speech AFTER this argument was made
 *   3. Nobody on the opposing side actually responded to it (directly or indirectly)
 */
export function computeDroppedIds(args) {
  const nonNote = args.filter(a => !a.isJudgeNote);

  // Build a set of all arg IDs that have been responded to (at any depth)
  const respondedTo = new Set();
  for (const a of nonNote) {
    if (a.respondsTo) respondedTo.add(a.respondsTo);
  }

  // Find the highest speech order in the debate (latest speech that happened)
  let maxSpeechOrder = 0;
  for (const a of nonNote) {
    const order = SPEECH_ORDER[a.speaker] || 0;
    if (order > maxSpeechOrder) maxSpeechOrder = order;
  }

  // Build a set of speech orders that actually occurred, per side
  const govSpeechOrders = new Set();
  const oppSpeechOrders = new Set();
  for (const a of nonNote) {
    const order = SPEECH_ORDER[a.speaker] || 0;
    const side = getSide(a.team);
    if (side === 'gov') govSpeechOrders.add(order);
    else if (side === 'opp') oppSpeechOrders.add(order);
  }

  const dropped = new Set();

  for (const arg of nonNote) {
    // Skip non-substantive points
    if (arg.isPOI || arg.isWeighing || arg.isExtension) continue;

    // Skip if someone responded to this arg
    if (respondedTo.has(arg.id)) continue;

    const argSide = getSide(arg.team);
    if (!argSide) continue;

    const argSpeechOrder = SPEECH_ORDER[arg.speaker] || 0;
    const opposingSpeechOrders = argSide === 'gov' ? oppSpeechOrders : govSpeechOrders;

    // Check if the opposing side had at least one speech after this argument
    let opposingHadLaterSpeech = false;
    for (const order of opposingSpeechOrders) {
      if (order > argSpeechOrder) {
        opposingHadLaterSpeech = true;
        break;
      }
    }

    if (opposingHadLaterSpeech) {
      dropped.add(arg.id);
    }
  }

  return dropped;
}

/**
 * Estimate node height for word-wrapped HTML text at a given width.
 * Approximates line wrapping at ~45 chars per line for 320px nodes.
 */
export function estimateNodeHeight(arg) {
  const CHARS_PER_LINE = 45;
  const LINE_H = 16;
  const HEADER_H = 28;
  const PADDING = 16;

  let lines = 0;

  // Claim text
  const claim = arg.claim || arg.text || '';
  lines += Math.max(1, Math.ceil(claim.length / CHARS_PER_LINE));

  // Mechanisms
  const mechs = arg.mechanisms || (arg.mechanism ? [arg.mechanism] : []);
  for (const m of mechs) {
    lines += Math.max(1, Math.ceil((m.length + 3) / CHARS_PER_LINE)); // +3 for "M: "
  }

  // Impacts
  const imps = arg.impacts || (arg.impact ? [arg.impact] : []);
  for (const imp of imps) {
    lines += Math.max(1, Math.ceil((imp.length + 3) / CHARS_PER_LINE));
  }

  // Refutations
  const refs = arg.refutations || [];
  for (const r of refs) {
    lines += Math.max(1, Math.ceil((r.length + 3) / CHARS_PER_LINE));
  }

  return HEADER_H + lines * LINE_H + PADDING;
}
