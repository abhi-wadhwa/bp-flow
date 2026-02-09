import { useState, useRef, useEffect } from 'react';
import { TEAM_COLORS } from './constants';

export default function ManualLinkPopup({ args, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = args.filter(a => {
    const q = search.toLowerCase();
    return (
      a.text.toLowerCase().includes(q) ||
      a.speaker.toLowerCase().includes(q) ||
      a.team.toLowerCase().includes(q) ||
      (a.clashTheme && a.clashTheme.toLowerCase().includes(q))
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border overflow-hidden"
        style={{ background: '#1a1d27', borderColor: '#2e3245' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-3 border-b" style={{ borderColor: '#2e3245' }}>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search arguments to link to..."
            className="w-full bg-transparent outline-none text-sm"
            style={{ color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}
            onKeyDown={e => {
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="text-xs text-center py-4" style={{ color: '#94a3b8' }}>
              No matching arguments
            </div>
          )}
          {filtered.map(arg => (
            <button
              key={arg.id}
              onClick={() => onSelect(arg.id)}
              className="w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors hover:opacity-90"
              style={{
                background: '#222533',
                borderLeft: `3px solid ${TEAM_COLORS[arg.team]}`,
              }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[10px] font-bold"
                  style={{ color: TEAM_COLORS[arg.team] }}
                >
                  {arg.speaker}
                </span>
                {arg.clashTheme && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: '#2e3245', color: '#94a3b8' }}
                  >
                    {arg.clashTheme}
                  </span>
                )}
              </div>
              <div
                className="text-xs"
                style={{ color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}
              >
                {arg.text}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
