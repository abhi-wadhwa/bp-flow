import { TEAM_COLORS } from './constants';

export default function AIClassificationPopup({
  suggestion,
  allArgs,
  onConfirm,
  onDismiss,
  onManualLink,
}) {
  if (!suggestion) return null;

  const respondedArg = suggestion.responds_to
    ? allArgs.find(a => a.id === suggestion.responds_to)
    : null;

  return (
    <div
      className="mx-3 mb-2 p-2.5 rounded-lg border text-xs animate-in"
      style={{
        background: '#1a1d27',
        borderColor: suggestion.confidence >= 0.6 ? '#22C55E55' : '#F59E0B55',
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-medium" style={{ color: '#94a3b8' }}>
          AI Classification {suggestion.source === 'heuristic' ? '(heuristic)' : ''}
        </span>
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

      {suggestion.clash_theme && (
        <div className="mb-1" style={{ color: '#e2e8f0' }}>
          Theme: <span className="font-medium">{suggestion.clash_theme}</span>
          {suggestion.is_new_theme && (
            <span className="ml-1 text-[10px]" style={{ color: '#22C55E' }}>new</span>
          )}
        </div>
      )}

      {respondedArg && (
        <div className="mb-1.5" style={{ color: '#e2e8f0' }}>
          <span style={{ color: TEAM_COLORS[respondedArg.team] }}>&#8627;</span>{' '}
          responds to {respondedArg.speaker}: "{respondedArg.text.slice(0, 50)}..."
        </div>
      )}

      <div className="flex gap-1.5 mt-2">
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
