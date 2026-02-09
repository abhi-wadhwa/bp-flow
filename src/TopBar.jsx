import { TEAM_COLORS, SPEECH_DURATION, POI_START, POI_END, SHORTCUTS } from './constants';
import { useState } from 'react';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function TimerDisplay({ timer, onToggle, onReset }) {
  const elapsed = timer.elapsed;
  const pct = Math.min(elapsed / SPEECH_DURATION, 1);

  let zone = 'protected';
  let zoneColor = '#EF4444';
  if (elapsed >= POI_START && elapsed < POI_END) {
    zone = 'poi';
    zoneColor = '#22C55E';
  } else if (elapsed >= POI_END) {
    zone = 'protected';
    zoneColor = '#EF4444';
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className="px-2 py-1 rounded text-xs font-medium transition-colors"
          style={{
            background: timer.running ? '#EF444433' : '#22C55E33',
            color: timer.running ? '#EF4444' : '#22C55E',
          }}
        >
          {timer.running ? 'STOP' : 'START'}
        </button>
        <button
          onClick={onReset}
          className="px-2 py-1 rounded text-xs transition-colors"
          style={{ background: '#2e3245', color: '#94a3b8' }}
        >
          RST
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="text-lg font-bold tabular-nums"
          style={{ fontFamily: 'JetBrains Mono, monospace', color: zoneColor }}
        >
          {formatTime(elapsed)}
        </span>
        <span className="text-xs" style={{ color: zoneColor }}>
          {zone === 'poi' ? 'POI OPEN' : elapsed < POI_START ? 'PROTECTED' : elapsed >= SPEECH_DURATION ? 'TIME' : 'PROTECTED'}
        </span>
      </div>

      {/* Timer bar */}
      <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ background: '#2e3245' }}>
        {/* Protected zone markers */}
        <div className="relative w-full h-full">
          <div
            className="absolute h-full rounded-full transition-all duration-100"
            style={{
              width: `${pct * 100}%`,
              background: zoneColor,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function TopBar({
  motion,
  activeSpeaker,
  speakers,
  view,
  onViewToggle,
  timer,
  onTimerToggle,
  onTimerReset,
  onAdjudicate,
  teamNames,
  onExport,
}) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const speaker = speakers[activeSpeaker];

  return (
    <div
      className="flex items-center justify-between px-4 py-2 border-b"
      style={{ background: '#1a1d27', borderColor: '#2e3245' }}
    >
      {/* Left: Motion + Speaker */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <span
          className="text-xs font-bold tracking-wider"
          style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}
        >
          British Parliamentary Flow
        </span>
        <div className="h-4 w-px" style={{ background: '#2e3245' }} />
        <span
          className="text-xs truncate max-w-md"
          style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}
          title={motion}
        >
          {motion}
        </span>
        <div className="h-4 w-px" style={{ background: '#2e3245' }} />
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: TEAM_COLORS[speaker.team] }}
          />
          <span className="text-sm font-medium">
            {speaker.role}
          </span>
          <span className="text-xs" style={{ color: '#94a3b8' }}>
            {teamNames[speaker.team]}
          </span>
        </div>
      </div>

      {/* Center: Timer */}
      <div className="flex-shrink-0">
        <TimerDisplay
          timer={timer}
          onToggle={onTimerToggle}
          onReset={onTimerReset}
        />
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2 flex-1 justify-end">
        <button
          onClick={onViewToggle}
          className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
          style={{
            background: '#2e3245',
            color: '#e2e8f0',
          }}
        >
          {view === 'columns' ? 'Clash Map' : 'Columns'} <span style={{ color: '#94a3b8' }}>⌘J</span>
        </button>
        <button
          onClick={onAdjudicate}
          className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
          style={{
            background: '#2e3245',
            color: '#e2e8f0',
          }}
        >
          Adjudicate
        </button>
        <button
          onClick={onExport}
          className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
          style={{
            background: '#2e3245',
            color: '#e2e8f0',
          }}
        >
          Export
        </button>
        <div className="relative">
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="px-2 py-1.5 rounded text-xs transition-colors"
            style={{ background: '#2e3245', color: '#94a3b8' }}
            title="Keyboard shortcuts"
          >
            ?
          </button>
          {showShortcuts && (
            <div
              className="absolute right-0 top-full mt-2 p-3 rounded-lg border z-50 min-w-[240px]"
              style={{ background: '#1a1d27', borderColor: '#2e3245' }}
            >
              <div className="text-xs font-semibold mb-2" style={{ color: '#94a3b8' }}>
                KEYBOARD SHORTCUTS
              </div>
              {SHORTCUTS.map(s => (
                <div key={s.keys} className="flex justify-between text-xs py-0.5">
                  <span style={{ color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                    {s.keys}
                  </span>
                  <span style={{ color: '#e2e8f0' }}>{s.action}</span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t text-xs" style={{ borderColor: '#2e3245', color: '#94a3b8' }}>
                Press Esc or ? to close
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
