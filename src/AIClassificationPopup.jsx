import { TEAM_COLORS, REBUTTAL_COLORS, TYPE_COLORS } from './constants';

const TYPE_LABELS = {
  claim: 'CLAIM',
  mechanism: 'MECHANISM',
  impact: 'IMPACT',
  refutation: 'REFUTATION',
};

const TYPE_KEYS = ['claim', 'mechanism', 'impact', 'refutation'];
const TYPE_SHORTCUT = { claim: 'C', mechanism: 'M', impact: 'I', refutation: 'R' };

export default function AIClassificationPopup({
  suggestion,
  allArgs,
  pendingText,
  onConfirm,
  onDismiss,
  onManualLink,
  onOverrideType,
}) {
  if (!suggestion) return null;

  const argType = suggestion.argument_type || 'claim';
  const typeColor = TYPE_COLORS[argType];

  // Find referenced args
  const belongsToArg = suggestion.belongs_to
    ? allArgs.find(a => a.id === suggestion.belongs_to)
    : null;
  const respondsToArg = suggestion.responds_to
    ? allArgs.find(a => a.id === suggestion.responds_to)
    : null;

  const rebuttalTarget = suggestion.rebuttal_target;
  const targetColor = rebuttalTarget ? REBUTTAL_COLORS[rebuttalTarget] : null;

  return (
    <div
      className="mx-3 mb-2 p-2.5 rounded-lg border text-xs animate-in"
      style={{
        background: '#1a1d27',
        borderColor: `${typeColor}55`,
      }}
    >
      {/* Type badge + confidence */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide"
            style={{ background: `${typeColor}22`, color: typeColor }}
          >
            {TYPE_LABELS[argType]}
          </span>
          {suggestion.source === 'heuristic' && (
            <span className="text-[10px]" style={{ color: '#64748b' }}>(heuristic)</span>
          )}
        </div>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            background: suggestion.confidence >= 0.6 ? '#22C55E22' : '#F59E0B22',
            color: suggestion.confidence >= 0.6 ? '#22C55E' : '#F59E0B',
          }}
        >
          {Math.round(suggestion.confidence * 100)}%
        </span>
      </div>

      {/* Pending text preview */}
      {pendingText && (
        <div className="mb-1.5 text-[11px] truncate" style={{ color: '#94a3b8' }}>
          "{pendingText.length > 60 ? pendingText.slice(0, 60) + '...' : pendingText}"
        </div>
      )}

      {/* Mechanism/Impact: attaches to */}
      {(argType === 'mechanism' || argType === 'impact') && belongsToArg && (
        <div className="mb-1" style={{ color: '#e2e8f0' }}>
          <span className="text-[10px]" style={{ color: '#94a3b8' }}>Attaches to: </span>
          <span style={{ color: TEAM_COLORS[belongsToArg.team] }}>{belongsToArg.speaker}</span>:{' '}
          "{(belongsToArg.claim || belongsToArg.text).slice(0, 50)}{(belongsToArg.claim || belongsToArg.text).length > 50 ? '...' : ''}"
        </div>
      )}

      {/* Mechanism/Impact with no target */}
      {(argType === 'mechanism' || argType === 'impact') && !belongsToArg && (
        <div className="mb-1 text-[10px]" style={{ color: '#F59E0B' }}>
          No matching argument found — will create as claim
        </div>
      )}

      {/* Refutation: responds to */}
      {argType === 'refutation' && respondsToArg && (
        <div className="mb-1" style={{ color: '#e2e8f0' }}>
          <span style={{ color: TEAM_COLORS[respondsToArg.team] }}>&#8627;</span>{' '}
          <span className="text-[10px]" style={{ color: '#94a3b8' }}>Responds to: </span>
          {respondsToArg.speaker}: "{(respondsToArg.claim || respondsToArg.text).slice(0, 50)}..."
        </div>
      )}

      {/* Rebuttal target */}
      {rebuttalTarget && respondsToArg && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="text-[10px]" style={{ color: '#94a3b8' }}>Attacks:</span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ color: targetColor, background: `${targetColor}22` }}
          >
            {rebuttalTarget.toUpperCase()}
          </span>
        </div>
      )}

      {/* Claim: theme */}
      {argType === 'claim' && suggestion.clash_theme && (
        <div className="mb-1" style={{ color: '#e2e8f0' }}>
          <span className="text-[10px]" style={{ color: '#94a3b8' }}>Theme: </span>
          <span className="font-medium">{suggestion.clash_theme}</span>
          {suggestion.is_new_theme && (
            <span className="ml-1 text-[10px]" style={{ color: '#22C55E' }}>new</span>
          )}
        </div>
      )}

      {/* Type override buttons */}
      <div className="flex items-center gap-1 mt-2 mb-2">
        {TYPE_KEYS.map(type => (
          <button
            key={type}
            onClick={() => onOverrideType(type)}
            className="px-2 py-0.5 rounded text-[10px] font-semibold transition-colors"
            style={{
              background: type === argType ? `${TYPE_COLORS[type]}33` : '#2e3245',
              color: type === argType ? TYPE_COLORS[type] : '#64748b',
              border: type === argType ? `1px solid ${TYPE_COLORS[type]}44` : '1px solid transparent',
            }}
          >
            {TYPE_SHORTCUT[type]}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-1.5">
        <button
          onClick={onConfirm}
          className="px-2.5 py-1 rounded text-[10px] font-medium transition-colors"
          style={{ background: '#22C55E33', color: '#22C55E' }}
        >
          Confirm <span style={{ opacity: 0.6 }}>↵</span>
        </button>
        <button
          onClick={onManualLink}
          className="px-2.5 py-1 rounded text-[10px] font-medium transition-colors"
          style={{ background: '#3B82F633', color: '#3B82F6' }}
        >
          Link <span style={{ opacity: 0.6 }}>⌘K</span>
        </button>
        <button
          onClick={onDismiss}
          className="px-2.5 py-1 rounded text-[10px] font-medium transition-colors"
          style={{ background: '#2e3245', color: '#94a3b8' }}
        >
          Dismiss <span style={{ opacity: 0.6 }}>Esc</span>
        </button>
      </div>
    </div>
  );
}
