import { useRef, useEffect } from 'react';
import { TEAM_COLORS, TEAM_BG } from './constants';
import ArgumentCard from './ArgumentCard';

export default function SpeakerColumn({
  speaker,
  teamName,
  isActive,
  arguments: args,
  allArgs,
  onEditArg,
  inputRef,
  onClick,
}) {
  const scrollRef = useRef(null);
  const color = TEAM_COLORS[speaker.team];

  // Auto-scroll when new args are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [args.length]);

  return (
    <div
      className="flex flex-col h-full border-r transition-all flex-shrink-0 cursor-pointer"
      style={{
        width: '220px',
        minWidth: '220px',
        borderColor: isActive ? color : '#2e3245',
        background: isActive ? TEAM_BG[speaker.team] : 'transparent',
      }}
      onClick={onClick}
    >
      {/* Header */}
      <div
        className="px-3 py-2 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: '#2e3245' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: color }}
          />
          <div>
            <div
              className="text-xs font-bold"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {speaker.role}
            </div>
            <div className="text-[10px]" style={{ color: '#94a3b8' }}>
              {teamName} &middot; {speaker.title}
            </div>
          </div>
        </div>
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ background: `${color}22`, color }}
        >
          {args.length}
        </span>
      </div>

      {/* Arguments list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-0"
      >
        {args.length === 0 && !isActive && (
          <div className="text-xs text-center py-8" style={{ color: '#2e3245' }}>
            No arguments
          </div>
        )}
        {args.map(arg => (
          <ArgumentCard
            key={arg.id}
            arg={arg}
            allArgs={allArgs}
            onEdit={onEditArg}
          />
        ))}
      </div>

      {/* Active indicator bar */}
      {isActive && (
        <div className="h-0.5 flex-shrink-0" style={{ background: color }} />
      )}
    </div>
  );
}
