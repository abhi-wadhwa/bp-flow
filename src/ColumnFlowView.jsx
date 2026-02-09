import { useState, useRef, useEffect } from 'react';
import SpeakerColumn from './SpeakerColumn';
import AIClassificationPopup from './AIClassificationPopup';
import ManualLinkPopup from './ManualLinkPopup';
import { TEAM_COLORS } from './constants';

export default function ColumnFlowView({
  speakers,
  activeSpeaker,
  onSetActiveSpeaker,
  arguments: args,
  teamNames,
  onSubmitArgument,
  pendingSuggestion,
  onConfirmSuggestion,
  onDismissSuggestion,
  onManualLink,
  showManualLink,
  onCloseManualLink,
  onSelectLink,
  inputMode,
  onClearInputMode,
  judgeNotes,
}) {
  const [inputText, setInputText] = useState('');
  const [poiFrom, setPoiFrom] = useState(null);
  const showPoiSelect = inputMode === 'poi' && !poiFrom;
  const inputRef = useRef(null);

  useEffect(() => {
    if (!showManualLink && !showPoiSelect) {
      inputRef.current?.focus();
    }
  }, [activeSpeaker, showManualLink, showPoiSelect, pendingSuggestion]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    const argData = {
      text,
      isPOI: inputMode === 'poi',
      poiFrom: inputMode === 'poi' ? poiFrom : null,
      isExtension: inputMode === 'extension',
      isWeighing: inputMode === 'weighing',
      isJudgeNote: inputMode === 'judge_note',
    };

    setInputText('');
    setPoiFrom(null);
    onClearInputMode();
    onSubmitArgument(argData);
  };

  const handlePoiSelect = (speakerIdx) => {
    setPoiFrom(speakers[speakerIdx].role);
    setShowPoiSelect(false);
    inputRef.current?.focus();
  };

  const speaker = speakers[activeSpeaker];
  const color = TEAM_COLORS[speaker.team];

  // Get mode label
  let modeLabel = null;
  if (inputMode === 'poi') modeLabel = { text: 'POI', color: '#F59E0B', bg: '#F59E0B33' };
  if (inputMode === 'extension') modeLabel = { text: 'EXT', color: '#8B5CF6', bg: '#8B5CF633' };
  if (inputMode === 'weighing') modeLabel = { text: 'WEIGH', color: '#06B6D4', bg: '#06B6D433' };
  if (inputMode === 'judge_note') modeLabel = { text: 'NOTE', color: '#94a3b8', bg: '#94a3b833' };

  return (
    <div className="flex flex-col h-full">
      {/* Columns */}
      <div className="flex-1 flex overflow-x-auto">
        {speakers.map((sp, idx) => {
          const speakerArgs = args.filter(a => a.speakerIndex === idx && !a.isJudgeNote);
          return (
            <SpeakerColumn
              key={sp.role}
              speaker={sp}
              teamName={teamNames[sp.team]}
              isActive={idx === activeSpeaker}
              arguments={speakerArgs}
              allArgs={args}
              onEditArg={(id, text) => {}}
              inputRef={idx === activeSpeaker ? inputRef : null}
              onClick={() => onSetActiveSpeaker(idx)}
            />
          );
        })}

        {/* Judge notes column */}
        {judgeNotes.length > 0 && (
          <div
            className="flex flex-col h-full border-r flex-shrink-0"
            style={{
              width: '200px',
              minWidth: '200px',
              borderColor: '#2e3245',
            }}
          >
            <div
              className="px-3 py-2 border-b flex-shrink-0"
              style={{ borderColor: '#2e3245' }}
            >
              <div
                className="text-xs font-bold"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}
              >
                Judge Notes
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {judgeNotes.map((note, i) => (
                <div
                  key={i}
                  className="rounded px-2.5 py-2 mb-1.5 text-xs"
                  style={{
                    background: '#222533',
                    borderLeft: '3px solid #94a3b8',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#94a3b8',
                  }}
                >
                  <span className="text-[10px] font-medium" style={{ color: '#64748b' }}>
                    @ {speakers[note.speakerIndex]?.role}
                  </span>
                  <div className="mt-0.5">{note.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Classification Popup */}
      {pendingSuggestion && (
        <AIClassificationPopup
          suggestion={pendingSuggestion}
          allArgs={args}
          onConfirm={onConfirmSuggestion}
          onDismiss={onDismissSuggestion}
          onManualLink={onManualLink}
        />
      )}

      {/* Input bar */}
      <div
        className="px-4 py-3 border-t flex-shrink-0"
        style={{ background: '#1a1d27', borderColor: '#2e3245' }}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {/* Speaker indicator */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: color }}
            />
            <span
              className="text-xs font-bold"
              style={{ fontFamily: 'JetBrains Mono, monospace', color }}
            >
              {speaker.role}
            </span>
          </div>

          {/* Mode badge */}
          {modeLabel && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0"
              style={{ background: modeLabel.bg, color: modeLabel.color }}
            >
              {modeLabel.text}
              {inputMode === 'poi' && poiFrom && ` from ${poiFrom}`}
            </span>
          )}

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={
              inputMode === 'judge_note'
                ? 'Private judge note...'
                : inputMode === 'weighing'
                ? 'e.g., OG econ > OO rights because...'
                : `Flow ${speaker.role}...`
            }
            className="flex-1 bg-transparent outline-none text-sm"
            style={{
              color: '#e2e8f0',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />

          {/* Submit hint */}
          <span className="text-[10px] flex-shrink-0" style={{ color: '#2e3245' }}>
            Enter to submit
          </span>
        </form>

        {/* POI speaker select */}
        {showPoiSelect && (
          <div
            className="mt-2 p-2 rounded-lg border"
            style={{ background: '#222533', borderColor: '#2e3245' }}
          >
            <div className="text-xs mb-1.5" style={{ color: '#94a3b8' }}>
              POI from which speaker? (1-{speakers.length})
            </div>
            <div className="flex gap-1 flex-wrap">
              {speakers.map((sp, idx) => (
                <button
                  key={sp.role}
                  onClick={() => handlePoiSelect(idx)}
                  className="px-2 py-1 rounded text-xs transition-colors"
                  style={{
                    background: `${TEAM_COLORS[sp.team]}22`,
                    color: TEAM_COLORS[sp.team],
                    border: `1px solid ${TEAM_COLORS[sp.team]}44`,
                  }}
                >
                  {idx + 1}: {sp.role}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Manual Link Popup */}
      {showManualLink && (
        <ManualLinkPopup
          args={args.filter(a => !a.isJudgeNote)}
          onSelect={onSelectLink}
          onClose={onCloseManualLink}
        />
      )}
    </div>
  );
}
