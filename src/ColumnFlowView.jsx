import { useState, useRef, useEffect } from 'react';
import SpeakerColumn from './SpeakerColumn';
import AIClassificationPopup from './AIClassificationPopup';
import BatchPreviewPopup from './BatchPreviewPopup';
import ManualLinkPopup from './ManualLinkPopup';
import { TEAM_COLORS } from './constants';

export default function ColumnFlowView({
  speakers,
  activeSpeaker,
  onSetActiveSpeaker,
  arguments: args,
  teamNames,
  onSubmitInput,
  onEditArg,
  pendingSuggestion,
  pendingText,
  classifying,
  onConfirmSuggestion,
  onDismissSuggestion,
  onManualLink,
  onOverrideType,
  showManualLink,
  onCloseManualLink,
  onSelectLink,
  inputMode,
  onClearInputMode,
  judgeNotes,
  pendingInputType,
  pendingBatch,
  onConfirmBatch,
  onDismissBatch,
  onRemoveBatchPoint,
  onEditBatchPoint,
}) {
  const [inputText, setInputText] = useState('');
  const [poiFrom, setPoiFrom] = useState(null);
  const showPoiSelect = inputMode === 'poi' && !poiFrom;

  const inputRef = useRef(null);

  const hasPending = !!pendingSuggestion || !!pendingBatch;

  useEffect(() => {
    if (!showManualLink && !showPoiSelect && !pendingBatch) {
      inputRef.current?.focus();
    }
  }, [activeSpeaker, showManualLink, showPoiSelect, pendingSuggestion, pendingBatch]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    const inputData = {
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
    onSubmitInput(inputData);
  };

  const handlePoiSelect = (speakerIdx) => {
    setPoiFrom(speakers[speakerIdx].role);
    inputRef.current?.focus();
  };

  const speaker = speakers[activeSpeaker];
  const color = TEAM_COLORS[speaker.team];

  let modeLabel = null;
  if (inputMode === 'poi') modeLabel = { text: 'POI', color: '#F59E0B', bg: '#F59E0B33' };
  if (inputMode === 'extension') modeLabel = { text: 'EXT', color: '#8B5CF6', bg: '#8B5CF633' };
  if (inputMode === 'weighing') modeLabel = { text: 'WEIGH', color: '#06B6D4', bg: '#06B6D433' };
  if (inputMode === 'judge_note') modeLabel = { text: 'NOTE', color: '#94a3b8', bg: '#94a3b833' };

  return (
    <div className="flex h-full">
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
              onEditArg={onEditArg}
              inputRef={null}
              onClick={() => onSetActiveSpeaker(idx)}
            />
          );
        })}

        {judgeNotes.length > 0 && (
          <div
            className="flex flex-col h-full border-r flex-shrink-0"
            style={{ width: '200px', minWidth: '200px', borderColor: '#2e3245' }}
          >
            <div className="px-3 py-2 border-b flex-shrink-0" style={{ borderColor: '#2e3245' }}>
              <div className="text-xs font-bold tracking-wide" style={{ color: '#94a3b8' }}>
                Judge Notes
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {judgeNotes.map((note, i) => (
                <div
                  key={i}
                  className="rounded px-2.5 py-2 mb-1.5 text-xs"
                  style={{ background: '#222533', borderLeft: '3px solid #94a3b8', color: '#94a3b8' }}
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

      {/* Right side panel */}
      <div
        className="flex flex-col h-full border-l flex-shrink-0"
        style={{ width: '300px', minWidth: '300px', background: '#1a1d27', borderColor: '#2e3245' }}
      >
        {/* Panel header */}
        <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: '#2e3245' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-sm font-bold" style={{ fontFamily: 'JetBrains Mono, monospace', color }}>
                {speaker.role}
              </span>
              <span className="text-xs" style={{ color: '#64748b' }}>{speaker.title}</span>
            </div>
            {modeLabel && (
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold"
                style={{ background: modeLabel.bg, color: modeLabel.color }}
              >
                {modeLabel.text}
                {inputMode === 'poi' && poiFrom && ` from ${poiFrom}`}
              </span>
            )}
          </div>
        </div>

        {/* Batch preview popup */}
        {pendingBatch && (
          <div className="flex-shrink-0">
            <BatchPreviewPopup
              points={pendingBatch.points}
              speaker={pendingBatch.speaker}
              team={pendingBatch.team}
              allArgs={args}
              onConfirm={onConfirmBatch}
              onDismiss={onDismissBatch}
              onRemovePoint={onRemoveBatchPoint}
              onEditPoint={onEditBatchPoint}
            />
          </div>
        )}

        {/* AI Classification Popup (single point) */}
        {pendingSuggestion && !pendingBatch && (
          <div className="flex-shrink-0">
            <AIClassificationPopup
              suggestion={pendingSuggestion}
              allArgs={args}
              pendingText={pendingText}
              onConfirm={onConfirmSuggestion}
              onDismiss={onDismissSuggestion}
              onManualLink={onManualLink}
              onOverrideType={onOverrideType}
            />
          </div>
        )}

        {/* Input area */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Classifying / deconstructing indicator */}
          {classifying && (
            <div className="flex items-center gap-2 mb-2 text-[10px]" style={{ color: '#94a3b8' }}>
              <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              {pendingBatch ? 'Deconstructing...' : 'Classifying...'}
            </div>
          )}

          {/* Single textarea */}
          <div>
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  if (pendingSuggestion && !inputText.trim()) {
                    e.preventDefault();
                    onConfirmSuggestion();
                    return;
                  }
                  if (pendingBatch && !inputText.trim()) {
                    e.preventDefault();
                    onConfirmBatch();
                    return;
                  }
                  if (inputText.trim()) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }
                if (e.key === 'Escape') {
                  if (pendingBatch) {
                    e.preventDefault();
                    onDismissBatch();
                  } else if (pendingSuggestion) {
                    e.preventDefault();
                    onDismissSuggestion();
                  }
                }
              }}
              placeholder={
                pendingBatch
                  ? 'Enter=apply all  Esc=dismiss'
                  : pendingSuggestion
                  ? 'Enter=confirm  Esc=dismiss  ⌘K=link  C/M/I/R=override'
                  : inputMode === 'judge_note'
                  ? 'Private judge note...'
                  : 'Type a point and press Enter — or paste a speech to deconstruct'
              }
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none border transition-colors"
              style={{
                background: '#222533',
                color: '#e2e8f0',
                borderColor: pendingBatch ? '#3B82F655' : pendingSuggestion ? '#22C55E55' : '#2e3245',
                minHeight: '88px',
              }}
              rows={4}
              disabled={!!pendingBatch}
            />
          </div>

          {/* POI speaker select */}
          {showPoiSelect && (
            <div className="p-2.5 rounded-lg border mt-3" style={{ background: '#222533', borderColor: '#2e3245' }}>
              <div className="text-xs mb-2" style={{ color: '#94a3b8' }}>POI from which speaker?</div>
              <div className="flex gap-1.5 flex-wrap">
                {speakers.map((sp, idx) => (
                  <button
                    key={sp.role}
                    onClick={() => handlePoiSelect(idx)}
                    className="px-2.5 py-1.5 rounded text-xs transition-colors"
                    style={{
                      background: `${TEAM_COLORS[sp.team]}22`,
                      color: TEAM_COLORS[sp.team],
                      border: `1px solid ${TEAM_COLORS[sp.team]}44`,
                    }}
                  >
                    {sp.role}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hint text */}
          {!hasPending && !classifying && (
            <div className="mt-3 text-[10px] leading-relaxed" style={{ color: '#4a5568' }}>
              <div>Type a point — AI classifies as claim, mechanism, impact, or refutation.</div>
              <div className="mt-0.5">Paste a long speech — AI deconstructs it into structured arguments.</div>
              <div className="mt-1">Use <span style={{ color: '#64748b' }}>⌘P</span> for POI, <span style={{ color: '#64748b' }}>⌘W</span> for weighing, <span style={{ color: '#64748b' }}>⌘E</span> for extension.</div>
            </div>
          )}
        </div>

        {/* Submit bar */}
        <div className="px-4 py-2.5 border-t flex-shrink-0 flex items-center justify-between" style={{ borderColor: '#2e3245' }}>
          <span className="text-[10px]" style={{ color: '#64748b' }}>
            {pendingBatch
              ? '↵ apply all · esc dismiss'
              : pendingSuggestion
              ? '↵ confirm · esc dismiss · ⌘K link'
              : '↵ submit · tab next speaker'
            }
          </span>
          <button
            onClick={pendingBatch ? onConfirmBatch : handleSubmit}
            disabled={pendingBatch ? false : (!inputText.trim() || !!pendingSuggestion)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
            style={{
              background: pendingBatch ? '#22C55E33'
                : inputText.trim() && !pendingSuggestion ? `${color}33` : '#2e3245',
              color: pendingBatch ? '#22C55E'
                : inputText.trim() && !pendingSuggestion ? color : '#64748b',
            }}
          >
            {pendingBatch ? 'Apply All' : 'Submit'}
          </button>
        </div>
      </div>

      {showManualLink && (
        <ManualLinkPopup
          args={args.filter(a => !a.isJudgeNote)}
          pendingType={pendingInputType}
          onSelect={onSelectLink}
          onClose={onCloseManualLink}
        />
      )}
    </div>
  );
}
