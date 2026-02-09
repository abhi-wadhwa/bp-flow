export const TEAM_COLORS = {
  OG: '#3B82F6',
  OO: '#EF4444',
  CG: '#22C55E',
  CO: '#F59E0B',
};

export const TEAM_BG = {
  OG: 'rgba(59, 130, 246, 0.12)',
  OO: 'rgba(239, 68, 68, 0.12)',
  CG: 'rgba(34, 197, 94, 0.12)',
  CO: 'rgba(245, 158, 11, 0.12)',
};

export const FULL_ROUND_SPEAKERS = [
  { role: 'PM', title: 'Prime Minister', team: 'OG', order: 1 },
  { role: 'LO', title: 'Leader of Opposition', team: 'OO', order: 2 },
  { role: 'DPM', title: 'Deputy PM', team: 'OG', order: 3 },
  { role: 'DLO', title: 'Deputy LO', team: 'OO', order: 4 },
  { role: 'MG', title: 'Member of Government', team: 'CG', order: 5 },
  { role: 'MO', title: 'Member of Opposition', team: 'CO', order: 6 },
  { role: 'GW', title: 'Government Whip', team: 'CG', order: 7 },
  { role: 'OW', title: 'Opposition Whip', team: 'CO', order: 8 },
];

export const TOP_HALF_SPEAKERS = FULL_ROUND_SPEAKERS.slice(0, 4);

export const SPEECH_DURATION = 7 * 60; // 7 minutes in seconds
export const POI_START = 60; // 1 minute
export const POI_END = 6 * 60; // 6 minutes

export const SHORTCUTS = [
  { keys: 'Enter', action: 'Submit point / confirm' },
  { keys: 'Tab', action: 'Next speaker' },
  { keys: 'Shift+Tab', action: 'Previous speaker' },
  { keys: '⌘+P', action: 'POI mode' },
  { keys: '⌘+W', action: 'Weighing note' },
  { keys: '⌘+E', action: 'Extension marker' },
  { keys: '⌘+K', action: 'Manual link' },
  { keys: '⌘+/', action: 'Judge note' },
  { keys: '⌘+J', action: 'Toggle view' },
  { keys: '⌘+T', action: 'Start/stop timer' },
  { keys: '⌘+1-4', action: 'Quick rank team' },
  { keys: 'C/M/I/R', action: 'Override type (in popup)' },
  { keys: 'Esc', action: 'Dismiss/cancel' },
];

export const REBUTTAL_COLORS = {
  claim: '#94a3b8',
  mechanism: '#10B981',
  impact: '#F43F5E',
};

export const MECHANISM_INDICATOR_KEYWORDS = [
  'because', 'this works by', 'the reason is', 'the link is', 'causally',
  'the mechanism is', 'this happens through', 'the way this works',
  'since', 'due to', 'as a result of', 'driven by', 'enabled by',
];

export const IMPACT_INDICATOR_KEYWORDS = [
  'leading to', 'resulting in', 'this matters because', 'the harm is',
  'the benefit is', 'consequences', 'the impact is', 'which means',
  'therefore', 'so this causes', 'the outcome is', 'ultimately',
  'the significance is', 'what this means is',
];

export const TYPE_COLORS = {
  claim: '#94a3b8',
  mechanism: '#10B981',
  impact: '#F43F5E',
  refutation: '#F59E0B',
};

export const RESPONSE_KEYWORDS = [
  'resp', 'rebut', 'even if', 'on that', 'turns', 'on their',
  'counter', 'but', 'however', 'against', 'response', 'reply',
  'refute', 'deny', 'reject', 'challenge', 'undermine',
];

export const MECHANISM_KEYWORDS = [
  'link breaks', 'no link', 'no mechanism', 'mechanism fails',
  'doesn\'t lead to', 'doesn\'t cause', 'causal', 'no reason why',
  'why would', 'how does', 'doesn\'t follow', 'non-sequitur',
  'no evidence', 'assertion', 'unsubstantiated',
];

export const IMPACT_KEYWORDS = [
  'even if', 'so what', 'doesn\'t matter', 'negligible',
  'outweigh', 'outweighs', 'not significant', 'marginal',
  'minor impact', 'small harm', 'low magnitude', 'who cares',
  'no real impact', 'scale is small', 'limited effect',
];
