import { useState, useRef, useEffect } from 'react';
import SpeakerColumn from './SpeakerColumn';
import AIClassificationPopup from './AIClassificationPopup';
import ManualLinkPopup from './ManualLinkPopup';
import { TEAM_COLORS, REBUTTAL_COLORS } from './constants';

const REFUTATION_COLOR = '#F59E0B';

function TagList({ items, color, onRemove }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 mt-1">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-start gap-1.5 px-2 py-1 rounded text-[11px] group/tag"
          style={{ background: `${color}15`, color }}
        >
          <span className="flex-1 leading-snug">{item}</span>
          <button
            onClick={() => onRemove(i)}
            className="opacity-0 group-hover/tag:opacity-100 text-[10px] flex-shrink-0 transition-opacity"
            style={{ color }}
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}

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
  const [refutationText, setRefutationText] = useState('');
  const [mechanisms, setMechanisms] = useState([]);
  const [impacts, setImpacts] = useState([]);
  const [refutations, setRefutations] = useState([]);
  const [poiFrom, setPoiFrom] = useState(null);
  const showPoiSelect = inputMode === 'poi' && !poiFrom;

  const claimRef = useRef(null);
  const mechRef = useRef(null);
  const impactRef = useRef(null);
  const refutationRef = useRef(null);

  useEffect(() => {
    if (!showManualLink && !showPoiSelect) {
      if (inputMode === 'mechanism') {
        mechRef.current?.focus();
      } else if (inputMode === 'impact') {
        impactRef.current?.focus();
      } else {
        claimRef.current?.focus();
      }
    }
  }, [activeSpeaker, showManualLink, showPoiSelect, pendingSuggestion, inputMode]);

  const clearAll = () => {
    setClaimText('');
    setMechText('');
    setImpactText('');
    setRefutationText('');
    setMechanisms([]);
    setImpacts([]);
    setRefutations([]);
    setPoiFrom(null);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const claim = claimText.trim();
    if (!claim) return;

    // Collect any text still in the input fields
    const allMechs = [...mechanisms];
    if (mechText.trim()) allMechs.push(mechText.trim());
    const allImpacts = [...impacts];
    if (impactText.trim()) allImpacts.push(impactText.trim());
    const allRefutations = [...refutations];
    if (refutationText.trim()) allRefutations.push(refutationText.trim());

    const argData = {
      text: claim,
      mechanisms: allMechs,
      impacts: allImpacts,
      refutations: allRefutations,
      isPOI: inputMode === 'poi',
      poiFrom: inputMode === 'poi' ? poiFrom : null,
      isExtension: inputMode === 'extension',
      isWeighing: inputMode === 'weighing',
      isJudgeNote: inputMode === 'judge_note',
    };

    clearAll();
    onClearInputMode();
    onSubmitArgument(argData);
    setTimeout(() => claimRef.current?.focus(), 0);
  };

  const handleAnnotateField = (field, items, text, setText, setItems) => {
    // Collect the typed text + any accumulated items
    const all = [...items];
    if (text.trim()) all.push(text.trim());
    if (all.length === 0) return;
    for (const item of all) {
      onAnnotateLastArg(field, item);
    }
    setText('');
    setItems([]);
    onClearInputMode();
    claimRef.current?.focus();
  };

  const handlePoiSelect = (speakerIdx) => {
    setPoiFrom(speakers[speakerIdx].role);
    claimRef.current?.focus();
  };

  const speaker = speakers[activeSpeaker];
  const color = TEAM_COLORS[speaker.team];

  let modeLabel = null;
  if (inputMode === 'poi') modeLabel = { text: 'POI', color: '#F59E0B', bg: '#F59E0B33' };
  if (inputMode === 'extension') modeLabel = { text: 'EXT', color: '#8B5CF6', bg: '#8B5CF633' };
  if (inputMode === 'weighing') modeLabel = { text: 'WEIGH', color: '#06B6D4', bg: '#06B6D433' };
  if (inputMode === 'judge_note') modeLabel = { text: 'NOTE', color: '#94a3b8', bg: '#94a3b833' };

  const lastArg = [...args].reverse().find(a => !a.isJudgeNote);
  const canAnnotate = !!lastArg;
  const hasAnnotationContent = !claimText.trim() && (
    mechText.trim() || impactText.trim() || refutationText.trim() ||
    mechanisms.length > 0 || impacts.length > 0 || refutations.length > 0
  );

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
                  if (pendingSuggestion && !claimText.trim()) {
                    e.preventDefault();
                    onConfirmSuggestion();
                    return;
                  }
                  if (claimText.trim()) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }
                if (e.key === 'Escape' && pendingSuggestion) {
                  e.preventDefault();
                  onDismissSuggestion();
                }
              }}
              placeholder={
                pendingSuggestion
                  ? 'Enter=confirm  Esc=dismiss  ⌘K=link'
                  : inputMode === 'judge_note'
                  ? 'Private judge note...'
                  : 'What is the argument?'
              }
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none border transition-colors"
              style={{
                background: '#222533',
                color: '#e2e8f0',
                borderColor: pendingSuggestion ? '#22C55E55' : '#2e3245',
                minHeight: '72px',
              }}
              rows={3}
            />
          </div>

          {/* Mechanisms */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: REBUTTAL_COLORS.mechanism }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: REBUTTAL_COLORS.mechanism }} />
              Mechanisms
              <span className="font-normal" style={{ color: '#64748b' }}>— why / how</span>
            </label>
            <TagList
              items={mechanisms}
              color={REBUTTAL_COLORS.mechanism}
              onRemove={i => setMechanisms(prev => prev.filter((_, j) => j !== i))}
            />
            <textarea
              ref={mechRef}
              value={mechText}
              onChange={e => setMechText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (mechText.trim()) {
                    if (claimText.trim()) {
                      // Accumulate into local list (will submit with claim)
                      setMechanisms(prev => [...prev, mechText.trim()]);
                      setMechText('');
                    } else if (canAnnotate) {
                      onAnnotateLastArg('mechanisms', mechText.trim());
                      setMechText('');
                    }
                  }
                }
                if (e.key === 'Escape') claimRef.current?.focus();
              }}
              placeholder={mechanisms.length > 0 ? 'Add another mechanism...' : 'Why does the claim work?'}
              className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none border transition-colors mt-1"
              style={{
                background: '#222533',
                color: REBUTTAL_COLORS.mechanism,
                borderColor: inputMode === 'mechanism' ? REBUTTAL_COLORS.mechanism + '88' : '#2e3245',
              }}
              rows={2}
            />
          </div>

          {/* Impacts */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: REBUTTAL_COLORS.impact }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: REBUTTAL_COLORS.impact }} />
              Impacts
              <span className="font-normal" style={{ color: '#64748b' }}>— so what</span>
            </label>
            <TagList
              items={impacts}
              color={REBUTTAL_COLORS.impact}
              onRemove={i => setImpacts(prev => prev.filter((_, j) => j !== i))}
            />
            <textarea
              ref={impactRef}
              value={impactText}
              onChange={e => setImpactText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (impactText.trim()) {
                    if (claimText.trim()) {
                      setImpacts(prev => [...prev, impactText.trim()]);
                      setImpactText('');
                    } else if (canAnnotate) {
                      onAnnotateLastArg('impacts', impactText.trim());
                      setImpactText('');
                    }
                  }
                }
                if (e.key === 'Escape') claimRef.current?.focus();
              }}
              placeholder={impacts.length > 0 ? 'Add another impact...' : 'What happens as a result?'}
              className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none border transition-colors mt-1"
              style={{
                background: '#222533',
                color: REBUTTAL_COLORS.impact,
                borderColor: inputMode === 'impact' ? REBUTTAL_COLORS.impact + '88' : '#2e3245',
              }}
              rows={2}
            />
          </div>

          {/* Refutations */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: REFUTATION_COLOR }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: REFUTATION_COLOR }} />
              Refutations
              <span className="font-normal" style={{ color: '#64748b' }}>— pre-emptive responses</span>
            </label>
            <TagList
              items={refutations}
              color={REFUTATION_COLOR}
              onRemove={i => setRefutations(prev => prev.filter((_, j) => j !== i))}
            />
            <textarea
              ref={refutationRef}
              value={refutationText}
              onChange={e => setRefutationText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (refutationText.trim()) {
                    if (claimText.trim()) {
                      setRefutations(prev => [...prev, refutationText.trim()]);
                      setRefutationText('');
                    } else if (canAnnotate) {
                      onAnnotateLastArg('refutations', refutationText.trim());
                      setRefutationText('');
                    }
                  }
                }
                if (e.key === 'Escape') claimRef.current?.focus();
              }}
              placeholder={refutations.length > 0 ? 'Add another refutation...' : 'How might they respond to this?'}
              className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none border transition-colors mt-1"
              style={{
                background: '#222533',
                color: REFUTATION_COLOR,
                borderColor: '#2e3245',
              }}
              rows={2}
            />
          </div>

          {/* Annotation preview */}
          {hasAnnotationContent && lastArg && (
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
            <div className="p-2.5 rounded-lg border" style={{ background: '#222533', borderColor: '#2e3245' }}>
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
        </div>

        {/* Submit bar */}
        <div className="px-4 py-2.5 border-t flex-shrink-0 flex items-center justify-between" style={{ borderColor: '#2e3245' }}>
          <span className="text-[10px]" style={{ color: '#64748b' }}>
            {pendingSuggestion
              ? '↵ confirm · esc dismiss · ⌘K link'
              : '↵ add/submit · tab next field'
            }
          </span>
          <button
            onClick={handleSubmit}
            disabled={!claimText.trim()}
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
