import { useState, useRef, useEffect } from 'react';
import SpeakerColumn from './SpeakerColumn';
import AIClassificationPopup from './AIClassificationPopup';
import ManualLinkPopup from './ManualLinkPopup';
import { TEAM_COLORS, REBUTTAL_COLORS } from './constants';

export default function ColumnFlowView({
  speakers,
  activeSpeaker,
  onSetActiveSpeaker,
  arguments: args,
  teamNames,
  onSubmitArgument,
  onEditArg,
  onAnnotateLastArg,
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
  const [claimText, setClaimText] = useState('');
  const [mechText, setMechText] = useState('');
  const [impactText, setImpactText] = useState('');
  const [poiFrom, setPoiFrom] = useState(null);
  const showPoiSelect = inputMode === 'poi' && !poiFrom;

  const claimRef = useRef(null);
  const mechRef = useRef(null);
  const impactRef = useRef(null);

  useEffect(() => {
    if (!showManualLink && !showPoiSelect) {
      // Focus the right field based on input mode
      if (inputMode === 'mechanism') {
        mechRef.current?.focus();
      } else if (inputMode === 'impact') {
        impactRef.current?.focus();
      } else {
        claimRef.current?.focus();
      }
    }
  }, [activeSpeaker, showManualLink, showPoiSelect, pendingSuggestion, inputMode]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const claim = claimText.trim();
    if (!claim) return;

    const argData = {
      text: claim,
      mechanism: mechText.trim() || null,
      impact: impactText.trim() || null,
      isPOI: inputMode === 'poi',
      poiFrom: inputMode === 'poi' ? poiFrom : null,
      isExtension: inputMode === 'extension',
      isWeighing: inputMode === 'weighing',
      isJudgeNote: inputMode === 'judge_note',
    };

    setClaimText('');
    setMechText('');
    setImpactText('');
    setPoiFrom(null);
    onClearInputMode();
    onSubmitArgument(argData);
    // Refocus claim
    setTimeout(() => claimRef.current?.focus(), 0);
  };

  const handleMechSubmit = () => {
    const text = mechText.trim();
    if (!text) return;
    onAnnotateLastArg('mechanism', text);
    setMechText('');
    onClearInputMode();
    claimRef.current?.focus();
  };

  const handleImpactSubmit = () => {
    const text = impactText.trim();
    if (!text) return;
    onAnnotateLastArg('impact', text);
    setImpactText('');
    onClearInputMode();
    claimRef.current?.focus();
  };

  const handlePoiSelect = (speakerIdx) => {
    setPoiFrom(speakers[speakerIdx].role);
    claimRef.current?.focus();
  };

  const speaker = speakers[activeSpeaker];
  const color = TEAM_COLORS[speaker.team];

  // Get mode label
  let modeLabel = null;
  if (inputMode === 'poi') modeLabel = { text: 'POI', color: '#F59E0B', bg: '#F59E0B33' };
  if (inputMode === 'extension') modeLabel = { text: 'EXT', color: '#8B5CF6', bg: '#8B5CF633' };
  if (inputMode === 'weighing') modeLabel = { text: 'WEIGH', color: '#06B6D4', bg: '#06B6D433' };
  if (inputMode === 'judge_note') modeLabel = { text: 'NOTE', color: '#94a3b8', bg: '#94a3b833' };

  // Check if there's a recent argument to annotate
  const lastArg = [...args].reverse().find(a => !a.isJudgeNote);
  const canAnnotate = !!lastArg;

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
                className="text-xs font-bold tracking-wide"
                style={{ color: '#94a3b8' }}
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

      {/* Right side panel - Input */}
      <div
        className="flex flex-col h-full border-l flex-shrink-0"
        style={{
          width: '300px',
          minWidth: '300px',
          background: '#1a1d27',
          borderColor: '#2e3245',
        }}
      >
        {/* Panel header: speaker + mode */}
        <div
          className="px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: '#2e3245' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: color }}
              />
              <span
                className="text-sm font-bold"
                style={{ fontFamily: 'JetBrains Mono, monospace', color }}
              >
                {speaker.role}
              </span>
              <span className="text-xs" style={{ color: '#64748b' }}>
                {speaker.title}
              </span>
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

        {/* AI Classification Popup */}
        {pendingSuggestion && (
          <div className="flex-shrink-0">
            <AIClassificationPopup
              suggestion={pendingSuggestion}
              allArgs={args}
              onConfirm={onConfirmSuggestion}
              onDismiss={onDismissSuggestion}
              onManualLink={onManualLink}
            />
          </div>
        )}

        {/* Input fields */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Claim */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#94a3b8' }}>
              Claim
            </label>
            <textarea
              ref={claimRef}
              value={claimText}
              onChange={e => setClaimText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  // If suggestion pending and claim empty → confirm
                  if (pendingSuggestion && !claimText.trim()) {
                    e.preventDefault();
                    onConfirmSuggestion();
                    return;
                  }
                  if (e.key === 'Enter' && claimText.trim()) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }
                if (e.key === 'Escape') {
                  if (pendingSuggestion) {
                    e.preventDefault();
                    onDismissSuggestion();
                  }
                }
              }}
              placeholder={
                pendingSuggestion
                  ? 'Enter=confirm  Esc=dismiss  ⌘K=link'
                  : inputMode === 'judge_note'
                  ? 'Private judge note...'
                  : inputMode === 'weighing'
                  ? 'e.g., OG econ > OO rights because...'
                  : 'What is the argument?'
              }
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none border transition-colors"
              style={{
                background: '#222533',
                color: '#e2e8f0',
                borderColor: pendingSuggestion ? '#22C55E55' : '#2e3245',
                minHeight: '80px',
              }}
              rows={3}
            />
          </div>

          {/* Mechanism */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: REBUTTAL_COLORS.mechanism }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: REBUTTAL_COLORS.mechanism }} />
              Mechanism
              <span className="font-normal" style={{ color: '#64748b' }}>— why / how</span>
            </label>
            <textarea
              ref={mechRef}
              value={mechText}
              onChange={e => setMechText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (claimText.trim()) {
                    // Submit everything together
                    handleSubmit();
                  } else if (mechText.trim() && canAnnotate) {
                    // Annotate last argument
                    handleMechSubmit();
                  }
                }
                if (e.key === 'Escape') {
                  claimRef.current?.focus();
                }
              }}
              placeholder={canAnnotate ? 'Why does the claim work? (Enter to annotate last arg)' : 'Why does the claim work?'}
              className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none border transition-colors"
              style={{
                background: '#222533',
                color: REBUTTAL_COLORS.mechanism,
                borderColor: inputMode === 'mechanism' ? REBUTTAL_COLORS.mechanism + '88' : '#2e3245',
                minHeight: '52px',
              }}
              rows={2}
            />
          </div>

          {/* Impact */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: REBUTTAL_COLORS.impact }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: REBUTTAL_COLORS.impact }} />
              Impact
              <span className="font-normal" style={{ color: '#64748b' }}>— so what</span>
            </label>
            <textarea
              ref={impactRef}
              value={impactText}
              onChange={e => setImpactText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (claimText.trim()) {
                    handleSubmit();
                  } else if (impactText.trim() && canAnnotate) {
                    handleImpactSubmit();
                  }
                }
                if (e.key === 'Escape') {
                  claimRef.current?.focus();
                }
              }}
              placeholder={canAnnotate ? 'What happens as a result? (Enter to annotate last arg)' : 'What happens as a result?'}
              className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none border transition-colors"
              style={{
                background: '#222533',
                color: REBUTTAL_COLORS.impact,
                borderColor: inputMode === 'impact' ? REBUTTAL_COLORS.impact + '88' : '#2e3245',
                minHeight: '52px',
              }}
              rows={2}
            />
          </div>

          {/* Annotating preview when mech/impact has text but no claim */}
          {!claimText.trim() && (mechText.trim() || impactText.trim()) && lastArg && (
            <div
              className="px-2.5 py-2 rounded-lg text-[10px]"
              style={{ background: '#222533', color: '#94a3b8', border: '1px dashed #2e3245' }}
            >
              Will annotate: <span style={{ color: '#e2e8f0' }}>"{(lastArg.claim || lastArg.text).slice(0, 50)}{(lastArg.claim || lastArg.text).length > 50 ? '...' : ''}"</span>{' '}
              <span style={{ color: TEAM_COLORS[lastArg.team] }}>({lastArg.speaker})</span>
            </div>
          )}

          {/* POI speaker select */}
          {showPoiSelect && (
            <div
              className="p-2.5 rounded-lg border"
              style={{ background: '#222533', borderColor: '#2e3245' }}
            >
              <div className="text-xs mb-2" style={{ color: '#94a3b8' }}>
                POI from which speaker?
              </div>
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
        </div>

        {/* Submit bar */}
        <div
          className="px-4 py-2.5 border-t flex-shrink-0 flex items-center justify-between"
          style={{ borderColor: '#2e3245' }}
        >
          <span className="text-[10px]" style={{ color: '#64748b' }}>
            {pendingSuggestion
              ? '↵ confirm · esc dismiss · ⌘K link'
              : '↵ submit · ⇧↵ newline · tab next field'
            }
          </span>
          <button
            onClick={handleSubmit}
            disabled={!claimText.trim() && !(mechText.trim() || impactText.trim())}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
            style={{
              background: claimText.trim() ? `${color}33` : '#2e3245',
              color: claimText.trim() ? color : '#64748b',
            }}
          >
            Submit
          </button>
        </div>
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
