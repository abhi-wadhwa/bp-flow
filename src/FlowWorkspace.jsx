import { useState, useCallback, useEffect } from 'react';
import TopBar from './TopBar';
import ColumnFlowView from './ColumnFlowView';
import ClashMapView from './ClashMapView';
import AdjudicationPanel from './AdjudicationPanel';
import ExportModal from './ExportModal';
import { useTimer } from './useTimer';
import { heuristicClassify, classifyArgument, shouldDeconstruct, deconstructSpeech } from './classifier';

let nextArgId = 1;

export default function FlowWorkspace({ config }) {
  const { roundType, motion, teamNames } = config;
  const speakers = config.speakers;

  const [args, setArgs] = useState([]);
  const [judgeNotes, setJudgeNotes] = useState([]);
  const [activeSpeaker, setActiveSpeaker] = useState(0);
  const [view, setView] = useState('columns'); // 'columns' | 'clashmap' | 'adjudication'
  const [pendingInput, setPendingInput] = useState(null);
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const [pendingBatch, setPendingBatch] = useState(null); // { points: [...], speaker, team, speakerIndex, speechNumber }
  const [classifying, setClassifying] = useState(false);
  const [showManualLink, setShowManualLink] = useState(false);
  const [manualLinkTarget, setManualLinkTarget] = useState(null);
  const [inputMode, setInputMode] = useState(null);
  const [showExport, setShowExport] = useState(false);

  const { getTimer, toggleTimer, resetTimer, pauseTimer } = useTimer();

  const existingThemes = [...new Set(args.map(a => a.clashTheme).filter(Boolean))];

  // Main input handler — routes to single-point or batch deconstruction
  const handleSubmitInput = useCallback(async (inputData) => {
    if (inputData.isJudgeNote) {
      setJudgeNotes(prev => [...prev, {
        text: inputData.text,
        speakerIndex: activeSpeaker,
        timestamp: Date.now(),
      }]);
      return;
    }

    const speaker = speakers[activeSpeaker];
    const pending = {
      text: inputData.text,
      speakerIndex: activeSpeaker,
      speaker: speaker.role,
      team: speaker.team,
      speechNumber: speaker.order,
      isPOI: inputData.isPOI || false,
      poiFrom: inputData.poiFrom || null,
      isExtension: inputData.isExtension || false,
      isWeighing: inputData.isWeighing || false,
    };

    // Check if input is long enough to deconstruct
    if (shouldDeconstruct(inputData.text)) {
      setClassifying(true);
      try {
        const points = await deconstructSpeech(
          inputData.text,
          speaker.role,
          speaker.team,
          speaker.order,
          args,
          existingThemes
        );
        if (points.length > 0) {
          setPendingBatch({
            points,
            speaker: speaker.role,
            team: speaker.team,
            speakerIndex: activeSpeaker,
            speechNumber: speaker.order,
            isPOI: pending.isPOI,
            poiFrom: pending.poiFrom,
            isExtension: pending.isExtension,
            isWeighing: pending.isWeighing,
          });
          setClassifying(false);
          return;
        }
      } catch (e) {
        console.warn('[deconstruct] Failed, falling back to single-point:', e.message);
      }
      setClassifying(false);
      // Fall through to single-point classification
    }

    // Single-point classification flow
    setPendingInput(pending);
    setClassifying(true);

    const heuristicResult = heuristicClassify(
      inputData.text, args, existingThemes, speaker.team
    );
    setPendingSuggestion(heuristicResult);

    if (heuristicResult.confidence >= 0.85) {
      applyClassification(pending, heuristicResult);
      setPendingInput(null);
      setPendingSuggestion(null);
      setClassifying(false);
      return;
    }

    try {
      const groqResult = await classifyArgument(
        inputData.text,
        speaker.role,
        speaker.team,
        speaker.order,
        args,
        existingThemes
      );

      if (groqResult.confidence >= 0.85) {
        applyClassification(pending, groqResult);
        setPendingInput(null);
        setPendingSuggestion(null);
        setClassifying(false);
        return;
      }

      setPendingSuggestion(groqResult);
    } catch {
      // Keep heuristic result
    }

    setClassifying(false);
  }, [activeSpeaker, speakers, args, existingThemes]);

  // Apply a single classification result
  const applyClassification = useCallback((input, suggestion) => {
    const argType = suggestion.argument_type || 'claim';

    if (argType === 'mechanism' || argType === 'impact') {
      const targetId = suggestion.belongs_to;
      const targetArg = targetId ? args.find(a => a.id === targetId) : null;

      if (targetArg) {
        const field = argType === 'mechanism' ? 'mechanisms' : 'impacts';
        setArgs(prev => prev.map(a =>
          a.id === targetId
            ? { ...a, [field]: [...(a[field] || []), input.text] }
            : a
        ));
        return;
      }
    }

    if (argType === 'refutation') {
      const id = String(nextArgId++);
      setArgs(prev => [...prev, {
        id,
        text: input.text,
        claim: input.text,
        mechanisms: [],
        impacts: [],
        refutations: [],
        rebuttalTarget: suggestion.rebuttal_target || null,
        speaker: input.speaker,
        team: input.team,
        speakerIndex: input.speakerIndex,
        speechNumber: input.speechNumber,
        isPOI: input.isPOI,
        poiFrom: input.poiFrom,
        isExtension: input.isExtension,
        isWeighing: input.isWeighing,
        isJudgeNote: false,
        clashTheme: suggestion.clash_theme || null,
        respondsTo: suggestion.responds_to || null,
        timestamp: Date.now(),
      }]);
      return;
    }

    const id = String(nextArgId++);
    setArgs(prev => [...prev, {
      id,
      text: input.text,
      claim: input.text,
      mechanisms: [],
      impacts: [],
      refutations: [],
      rebuttalTarget: null,
      speaker: input.speaker,
      team: input.team,
      speakerIndex: input.speakerIndex,
      speechNumber: input.speechNumber,
      isPOI: input.isPOI,
      poiFrom: input.poiFrom,
      isExtension: input.isExtension,
      isWeighing: input.isWeighing,
      isJudgeNote: false,
      clashTheme: suggestion.clash_theme || null,
      respondsTo: null,
      timestamp: Date.now(),
    }]);
  }, [args]);

  // Confirm a batch of deconstructed points
  const handleConfirmBatch = useCallback(() => {
    if (!pendingBatch) return;
    const { points, speaker, team, speakerIndex, speechNumber, isPOI, poiFrom, isExtension, isWeighing } = pendingBatch;

    const newArgs = points.map(point => {
      const id = String(nextArgId++);
      return {
        id,
        text: point.claim,
        claim: point.claim,
        mechanisms: point.mechanisms || [],
        impacts: point.impacts || [],
        refutations: [],
        rebuttalTarget: point.rebuttal_target || null,
        speaker,
        team,
        speakerIndex,
        speechNumber,
        isPOI,
        poiFrom,
        isExtension,
        isWeighing,
        isJudgeNote: false,
        clashTheme: point.clash_theme || null,
        respondsTo: point.responds_to || null,
        timestamp: Date.now(),
      };
    });

    setArgs(prev => [...prev, ...newArgs]);
    setPendingBatch(null);
  }, [pendingBatch]);

  const handleDismissBatch = useCallback(() => {
    setPendingBatch(null);
  }, []);

  const handleRemoveBatchPoint = useCallback((idx) => {
    setPendingBatch(prev => {
      if (!prev) return null;
      const newPoints = prev.points.filter((_, i) => i !== idx);
      if (newPoints.length === 0) return null;
      return { ...prev, points: newPoints };
    });
  }, []);

  const handleEditBatchPoint = useCallback((idx, field, value) => {
    setPendingBatch(prev => {
      if (!prev) return prev;
      const newPoints = [...prev.points];
      newPoints[idx] = { ...newPoints[idx], [field]: value };
      return { ...prev, points: newPoints };
    });
  }, []);

  const handleConfirmSuggestion = useCallback(() => {
    if (!pendingSuggestion || !pendingInput) return;
    applyClassification(pendingInput, pendingSuggestion);
    setPendingInput(null);
    setPendingSuggestion(null);
  }, [pendingSuggestion, pendingInput, applyClassification]);

  const handleDismissSuggestion = useCallback(() => {
    if (!pendingInput) return;
    applyClassification(pendingInput, {
      argument_type: 'claim',
      clash_theme: pendingSuggestion?.clash_theme || null,
      belongs_to: null,
      responds_to: null,
      rebuttal_target: null,
    });
    setPendingInput(null);
    setPendingSuggestion(null);
  }, [pendingInput, pendingSuggestion, applyClassification]);

  const handleOverrideType = useCallback((newType) => {
    if (!pendingSuggestion || !pendingInput) return;

    const speaker = speakers[pendingInput.speakerIndex];
    const updated = { ...pendingSuggestion, argument_type: newType };

    if (newType === 'claim') {
      updated.belongs_to = null;
      updated.responds_to = null;
      updated.rebuttal_target = null;
    } else if (newType === 'mechanism' || newType === 'impact') {
      updated.responds_to = null;
      updated.rebuttal_target = null;
      if (!updated.belongs_to) {
        for (let i = args.length - 1; i >= 0; i--) {
          if (args[i].team === speaker.team && !args[i].isJudgeNote && !args[i].isPOI) {
            updated.belongs_to = args[i].id;
            break;
          }
        }
      }
    } else if (newType === 'refutation') {
      updated.belongs_to = null;
      if (!updated.responds_to) {
        updated.rebuttal_target = null;
      }
    }

    setPendingSuggestion(updated);
  }, [pendingSuggestion, pendingInput, args, speakers]);

  const handleManualLink = useCallback(() => {
    setShowManualLink(true);
  }, []);

  const handleSelectLink = useCallback((targetArgId) => {
    if (pendingInput && pendingSuggestion) {
      const argType = pendingSuggestion.argument_type || 'claim';
      const targetArg = args.find(a => a.id === targetArgId);

      if (argType === 'mechanism' || argType === 'impact') {
        setPendingSuggestion(prev => ({
          ...prev,
          belongs_to: targetArgId,
          clash_theme: prev.clash_theme || targetArg?.clashTheme || null,
        }));
      } else if (argType === 'refutation') {
        setPendingSuggestion(prev => ({
          ...prev,
          responds_to: targetArgId,
          clash_theme: prev.clash_theme || targetArg?.clashTheme || null,
        }));
      } else {
        setPendingSuggestion(prev => ({
          ...prev,
          argument_type: 'refutation',
          responds_to: targetArgId,
          belongs_to: null,
          clash_theme: prev.clash_theme || targetArg?.clashTheme || null,
        }));
      }
    } else if (manualLinkTarget) {
      const targetArg = args.find(a => a.id === targetArgId);
      setArgs(prev => prev.map(a =>
        a.id === manualLinkTarget
          ? {
              ...a,
              respondsTo: targetArgId,
              clashTheme: a.clashTheme || targetArg?.clashTheme || a.clashTheme,
            }
          : a
      ));
    }

    setShowManualLink(false);
    setManualLinkTarget(null);
  }, [pendingInput, pendingSuggestion, manualLinkTarget, args]);

  const handleEditArg = useCallback((id, newText) => {
    setArgs(prev => prev.map(a =>
      a.id === id ? { ...a, text: newText, claim: newText } : a
    ));
  }, []);

  const handleRetheme = useCallback((oldTheme, newTheme) => {
    setArgs(prev => prev.map(a =>
      a.clashTheme === oldTheme ? { ...a, clashTheme: newTheme } : a
    ));
  }, []);

  const handleRelinkFromMap = useCallback((argId) => {
    setManualLinkTarget(argId);
    setShowManualLink(true);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName;

      if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey) {
        if (tag === 'TEXTAREA' || tag === 'INPUT') return;
        e.preventDefault();
        if (e.shiftKey) {
          pauseTimer(activeSpeaker);
          setActiveSpeaker(prev => Math.max(0, prev - 1));
        } else {
          pauseTimer(activeSpeaker);
          setActiveSpeaker(prev => Math.min(speakers.length - 1, prev + 1));
        }
        return;
      }

      if (e.key === 'Escape') {
        if (pendingBatch) {
          handleDismissBatch();
          return;
        }
        if (pendingSuggestion) {
          handleDismissSuggestion();
        }
        if (showManualLink) {
          setShowManualLink(false);
          setManualLinkTarget(null);
        }
        if (inputMode) {
          setInputMode(null);
        }
        if (showExport) {
          setShowExport(false);
        }
        return;
      }

      // Type override shortcuts when single-point popup is visible
      if (pendingSuggestion && !pendingBatch && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        const typeMap = { c: 'claim', m: 'mechanism', i: 'impact', r: 'refutation' };
        const overrideType = typeMap[e.key.toLowerCase()];
        if (overrideType && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          handleOverrideType(overrideType);
          return;
        }
      }

      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'j':
            e.preventDefault();
            setView(prev => prev === 'columns' ? 'clashmap' : 'columns');
            break;
          case 'p':
            e.preventDefault();
            setInputMode(prev => prev === 'poi' ? null : 'poi');
            break;
          case 'w':
            e.preventDefault();
            setInputMode(prev => prev === 'weighing' ? null : 'weighing');
            break;
          case 'e':
            e.preventDefault();
            setInputMode(prev => prev === 'extension' ? null : 'extension');
            break;
          case 'k':
            e.preventDefault();
            if (pendingSuggestion) {
              handleManualLink();
            } else {
              const lastArg = args[args.length - 1];
              if (lastArg) {
                setManualLinkTarget(lastArg.id);
                setShowManualLink(true);
              }
            }
            break;
          case '/':
            e.preventDefault();
            setInputMode(prev => prev === 'judge_note' ? null : 'judge_note');
            break;
          case 't':
            e.preventDefault();
            toggleTimer(activeSpeaker);
            break;
          case '1':
          case '2':
          case '3':
          case '4':
            break;
        }
      }

      // Enter to confirm
      if (e.key === 'Enter' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        if (pendingBatch) {
          e.preventDefault();
          handleConfirmBatch();
          return;
        }
        if (pendingSuggestion) {
          e.preventDefault();
          handleConfirmSuggestion();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeSpeaker, speakers.length, pendingSuggestion, pendingBatch, showManualLink,
    inputMode, showExport, args, pauseTimer, toggleTimer,
    handleConfirmSuggestion, handleDismissSuggestion, handleConfirmBatch, handleDismissBatch,
    handleManualLink, handleOverrideType,
  ]);

  if (view === 'adjudication') {
    return (
      <AdjudicationPanel
        speakers={speakers}
        teamNames={teamNames}
        arguments={args}
        roundType={roundType}
        onBack={() => setView('columns')}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: '#0f1117' }}>
      <TopBar
        motion={motion}
        activeSpeaker={activeSpeaker}
        speakers={speakers}
        view={view}
        onViewToggle={() => setView(prev => prev === 'columns' ? 'clashmap' : 'columns')}
        timer={getTimer(activeSpeaker)}
        onTimerToggle={() => toggleTimer(activeSpeaker)}
        onTimerReset={() => resetTimer(activeSpeaker)}
        onAdjudicate={() => setView('adjudication')}
        teamNames={teamNames}
        onExport={() => setShowExport(true)}
      />

      <div className="flex-1 overflow-hidden">
        {view === 'columns' ? (
          <ColumnFlowView
            speakers={speakers}
            activeSpeaker={activeSpeaker}
            onSetActiveSpeaker={setActiveSpeaker}
            arguments={args}
            teamNames={teamNames}
            onSubmitInput={handleSubmitInput}
            onEditArg={handleEditArg}
            pendingSuggestion={pendingSuggestion}
            pendingText={pendingInput?.text || null}
            classifying={classifying}
            onConfirmSuggestion={handleConfirmSuggestion}
            onDismissSuggestion={handleDismissSuggestion}
            onManualLink={handleManualLink}
            onOverrideType={handleOverrideType}
            showManualLink={showManualLink}
            onCloseManualLink={() => { setShowManualLink(false); setManualLinkTarget(null); }}
            onSelectLink={handleSelectLink}
            inputMode={inputMode}
            onClearInputMode={() => setInputMode(null)}
            judgeNotes={judgeNotes}
            pendingInputType={pendingSuggestion?.argument_type || null}
            pendingBatch={pendingBatch}
            onConfirmBatch={handleConfirmBatch}
            onDismissBatch={handleDismissBatch}
            onRemoveBatchPoint={handleRemoveBatchPoint}
            onEditBatchPoint={handleEditBatchPoint}
          />
        ) : (
          <ClashMapView
            arguments={args}
            onRetheme={handleRetheme}
            onRelink={handleRelinkFromMap}
          />
        )}
      </div>

      {showExport && (
        <ExportModal
          args={args}
          speakers={speakers}
          motion={motion}
          teamNames={teamNames}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
