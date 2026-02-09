import { useState } from 'react';
import { TEAM_COLORS, REBUTTAL_COLORS } from './constants';

const REFUTATION_COLOR = '#F59E0B';

export default function ArgumentCard({ arg, allArgs, onEdit, onRelink, onRetheme }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(arg.claim || arg.text);
  const color = TEAM_COLORS[arg.team];

  const respondedArg = arg.respondsTo
    ? allArgs.find(a => a.id === arg.respondsTo)
    : null;

  const handleDoubleClick = () => {
    setEditing(true);
    setEditText(arg.claim || arg.text);
  };

  const handleEditSubmit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== (arg.claim || arg.text)) {
      onEdit(arg.id, trimmed);
    }
    setEditing(false);
  };

  const rebuttalTargetLabel = arg.rebuttalTarget
    ? arg.rebuttalTarget.toUpperCase()
    : null;
  const rebuttalTargetColor = arg.rebuttalTarget
    ? REBUTTAL_COLORS[arg.rebuttalTarget] || REBUTTAL_COLORS.claim
    : null;

  // Support both old single-value and new array formats
  const mechanisms = arg.mechanisms || (arg.mechanism ? [arg.mechanism] : []);
  const impacts = arg.impacts || (arg.impact ? [arg.impact] : []);
  const refutations = arg.refutations || [];

  return (
    <div
      className="rounded px-2.5 py-2 mb-1.5 transition-all cursor-default group text-xs"
      style={{
        background: '#222533',
        borderLeft: `3px solid ${color}`,
      }}
      onDoubleClick={handleDoubleClick}
    >
      {editing ? (
        <input
          type="text"
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleEditSubmit();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={handleEditSubmit}
          className="w-full bg-transparent outline-none text-xs"
          style={{ color: '#e2e8f0' }}
          autoFocus
        />
      ) : (
        <>
          {/* Type badges */}
          <div className="flex items-center gap-1 mb-1">
            {arg.isPOI && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ background: '#F59E0B33', color: '#F59E0B' }}
              >
                POI{arg.poiFrom ? ` from ${arg.poiFrom}` : ''}
              </span>
            )}
            {arg.isExtension && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ background: '#8B5CF633', color: '#8B5CF6' }}
              >
                EXT
              </span>
            )}
            {arg.isWeighing && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ background: '#06B6D433', color: '#06B6D4' }}
              >
                WEIGH
              </span>
            )}
            {arg.clashTheme && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ background: `${color}22`, color: color }}
              >
                {arg.clashTheme}
              </span>
            )}
          </div>

          {/* Claim */}
          <div className="leading-relaxed" style={{ color: '#e2e8f0' }}>
            {arg.claim || arg.text}
          </div>

          {/* Mechanisms */}
          {mechanisms.map((m, i) => (
            <div
              key={`m-${i}`}
              className="mt-0.5 leading-relaxed text-[11px]"
              style={{ color: REBUTTAL_COLORS.mechanism }}
            >
              <span className="font-semibold">M:</span> {m}
            </div>
          ))}

          {/* Impacts */}
          {impacts.map((imp, i) => (
            <div
              key={`i-${i}`}
              className="mt-0.5 leading-relaxed text-[11px]"
              style={{ color: REBUTTAL_COLORS.impact }}
            >
              <span className="font-semibold">I:</span> {imp}
            </div>
          ))}

          {/* Refutations */}
          {refutations.map((r, i) => (
            <div
              key={`r-${i}`}
              className="mt-0.5 leading-relaxed text-[11px]"
              style={{ color: REFUTATION_COLOR }}
            >
              <span className="font-semibold">R:</span> {r}
            </div>
          ))}

          {/* Response link */}
          {respondedArg && (
            <div
              className="mt-1 text-[10px] flex items-center gap-1 flex-wrap"
              style={{ color: '#94a3b8' }}
            >
              <span style={{ color: TEAM_COLORS[respondedArg.team] }}>&#8627;</span>
              {rebuttalTargetLabel ? (
                <>
                  attacks{' '}
                  <span
                    className="font-semibold px-1 py-0.5 rounded"
                    style={{ color: rebuttalTargetColor, background: `${rebuttalTargetColor}22` }}
                  >
                    {rebuttalTargetLabel}
                  </span>
                  {' '}of {respondedArg.speaker}
                </>
              ) : (
                <>
                  resp to {respondedArg.speaker}: "{(respondedArg.claim || respondedArg.text).slice(0, 40)}{(respondedArg.claim || respondedArg.text).length > 40 ? '...' : ''}"
                </>
              )}
            </div>
          )}

          {/* Dropped indicator */}
          {arg.isDropped && (
            <div
              className="mt-1 text-[10px] flex items-center gap-1"
              style={{ color: '#EF4444' }}
            >
              !! dropped
            </div>
          )}
        </>
      )}
    </div>
  );
}
