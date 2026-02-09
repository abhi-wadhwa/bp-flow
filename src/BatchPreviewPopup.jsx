import { useState } from 'react';
import { TEAM_COLORS, TYPE_COLORS, REBUTTAL_COLORS } from './constants';

const REFUTATION_COLOR = '#F59E0B';

export default function BatchPreviewPopup({
  points,
  speaker,
  team,
  allArgs,
  onConfirm,
  onDismiss,
  onRemovePoint,
  onEditPoint,
}) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [editText, setEditText] = useState('');

  const color = TEAM_COLORS[team];

  const startEdit = (idx, text) => {
    setEditingIdx(idx);
    setEditText(text);
  };

  const commitEdit = () => {
    if (editingIdx !== null && editText.trim()) {
      onEditPoint(editingIdx, 'claim', editText.trim());
    }
    setEditingIdx(null);
    setEditText('');
  };

  return (
    <div
      className="mx-3 mb-2 rounded-lg border text-xs overflow-hidden"
      style={{ background: '#1a1d27', borderColor: '#3B82F655' }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{ borderBottom: '1px solid #2e3245' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide"
            style={{ background: '#3B82F622', color: '#3B82F6' }}
          >
            DECONSTRUCT
          </span>
          <span style={{ color: '#94a3b8' }}>
            {points.length} point{points.length !== 1 ? 's' : ''} extracted
          </span>
        </div>
        <span className="text-[10px] font-bold" style={{ color }}>
          {speaker}
        </span>
      </div>

      {/* Points list */}
      <div className="max-h-64 overflow-y-auto p-2 space-y-1.5">
        {points.map((point, idx) => {
          const isRefutation = point.is_refutation;
          const respondedArg = point.responds_to
            ? allArgs.find(a => a.id === point.responds_to)
            : null;

          return (
            <div
              key={idx}
              className="rounded px-2.5 py-2 group"
              style={{
                background: '#222533',
                borderLeft: `3px solid ${isRefutation ? REFUTATION_COLOR : color}`,
              }}
            >
              {/* Claim line */}
              <div className="flex items-start gap-1.5">
                <span
                  className="text-[10px] font-bold flex-shrink-0 mt-0.5"
                  style={{ color: isRefutation ? REFUTATION_COLOR : '#94a3b8' }}
                >
                  {isRefutation ? 'R' : idx + 1}.
                </span>
                {editingIdx === idx ? (
                  <input
                    type="text"
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitEdit();
                      if (e.key === 'Escape') setEditingIdx(null);
                    }}
                    onBlur={commitEdit}
                    className="flex-1 bg-transparent outline-none text-xs"
                    style={{ color: '#e2e8f0' }}
                    autoFocus
                  />
                ) : (
                  <span
                    className="flex-1 leading-relaxed cursor-text"
                    style={{ color: '#e2e8f0' }}
                    onDoubleClick={() => startEdit(idx, point.claim)}
                  >
                    {point.claim}
                  </span>
                )}
                <button
                  onClick={() => onRemovePoint(idx)}
                  className="opacity-0 group-hover:opacity-100 text-[10px] flex-shrink-0 transition-opacity px-1"
                  style={{ color: '#EF4444' }}
                >
                  x
                </button>
              </div>

              {/* Mechanisms */}
              {point.mechanisms.map((m, mi) => (
                <div
                  key={`m-${mi}`}
                  className="mt-0.5 ml-4 leading-relaxed text-[11px]"
                  style={{ color: REBUTTAL_COLORS.mechanism }}
                >
                  <span className="font-semibold">M:</span> {m}
                </div>
              ))}

              {/* Impacts */}
              {point.impacts.map((imp, ii) => (
                <div
                  key={`i-${ii}`}
                  className="mt-0.5 ml-4 leading-relaxed text-[11px]"
                  style={{ color: REBUTTAL_COLORS.impact }}
                >
                  <span className="font-semibold">I:</span> {imp}
                </div>
              ))}

              {/* Theme */}
              {point.clash_theme && (
                <div className="mt-1 ml-4">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px]"
                    style={{ background: `${color}22`, color }}
                  >
                    {point.clash_theme}
                  </span>
                </div>
              )}

              {/* Refutation target */}
              {respondedArg && (
                <div className="mt-1 ml-4 text-[10px]" style={{ color: '#94a3b8' }}>
                  <span style={{ color: TEAM_COLORS[respondedArg.team] }}>&#8627;</span>{' '}
                  resp to {respondedArg.speaker}: "{(respondedArg.claim || respondedArg.text).slice(0, 40)}..."
                  {point.rebuttal_target && (
                    <span
                      className="ml-1 font-semibold px-1 py-0.5 rounded"
                      style={{
                        color: REBUTTAL_COLORS[point.rebuttal_target],
                        background: `${REBUTTAL_COLORS[point.rebuttal_target]}22`,
                      }}
                    >
                      {point.rebuttal_target.toUpperCase()}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{ borderTop: '1px solid #2e3245' }}
      >
        <span className="text-[10px]" style={{ color: '#64748b' }}>
          double-click to edit · x to remove
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={onConfirm}
            className="px-3 py-1 rounded text-[10px] font-medium transition-colors"
            style={{ background: '#22C55E33', color: '#22C55E' }}
          >
            Apply All <span style={{ opacity: 0.6 }}>↵</span>
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
    </div>
  );
}
