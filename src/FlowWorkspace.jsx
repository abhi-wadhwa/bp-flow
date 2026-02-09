import { useState, useCallback, useEffect } from 'react';
import TopBar from './TopBar';
import ColumnFlowView from './ColumnFlowView';
import ClashMapView from './ClashMapView';
import AdjudicationPanel from './AdjudicationPanel';
import ExportModal from './ExportModal';
import { useTimer } from './useTimer';
import { classifyArgument } from './classifier';

let nextArgId = 1;

export default function FlowWorkspace({ config }) {
  const { roundType, motion, teamNames } = config;
  const speakers = config.speakers;

  const [args, setArgs] = useState([]);
  const [judgeNotes, setJudgeNotes] = useState([]);
  const [activeSpeaker, setActiveSpeaker] = useState(0);
  const [view, setView] = useState('columns'); // 'columns' | 'clashmap' | 'adjudication'
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const [pendingArgId, setPendingArgId] = useState(null);
  const [showManualLink, setShowManualLink] = useState(false);
  const [manualLinkTarget, setManualLinkTarget] = useState(null); // arg id to re-link
  const [inputMode, setInputMode] = useState(null); // 'poi' | 'extension' | 'weighing' | 'judge_note'
  const [showExport, setShowExport] = useState(false);

  const { getTimer, toggleTimer, resetTimer, pauseTimer } = useTimer();

  // Get unique themes
  const existingThemes = [...new Set(args.map(a => a.clashTheme).filter(Boolean))];

  const handleSubmitArgument = useCallback(async (argData) => {
    if (argData.isJudgeNote) {
      setJudgeNotes(prev => [...prev, {
        text: argData.text,
        speakerIndex: activeSpeaker,
        timestamp: Date.now(),
      }]);
      return;
    }

    const speaker = speakers[activeSpeaker];
    const id = String(nextArgId++);

    const newArg = {
      id,
      text: argData.text,
      claim: argData.text,
      mechanisms: argData.mechanisms || [],
      impacts: argData.impacts || [],
      refutations: argData.refutations || [],
      rebuttalTarget: null,
      speaker: speaker.role,
      team: speaker.team,
      speakerIndex: activeSpeaker,
      speechNumber: speaker.order,
      isPOI: argData.isPOI || false,
      poiFrom: argData.poiFrom || null,
      isExtension: argData.isExtension || false,
      isWeighing: argData.isWeighing || false,
      isJudgeNote: false,
      clashTheme: null,
      respondsTo: null,
      timestamp: Date.now(),
    };

    setArgs(prev => [...prev, newArg]);

    // Classify
    try {
      const result = await classifyArgument(
        argData.text,
        speaker.role,
        speaker.team,
        speaker.order,
        args,
        existingThemes
      );

      if (result.confidence >= 0.3 && (result.clash_theme || result.responds_to)) {
        setPendingSuggestion(result);
        setPendingArgId(id);
      } else if (result.clash_theme) {
        // Auto-apply low confidence theme
        setArgs(prev => prev.map(a =>
          a.id === id ? { ...a, clashTheme: result.clash_theme } : a
        ));
      }
    } catch {
      // Classification failed silently
    }
  }, [activeSpeaker, speakers, args, existingThemes]);

  const handleConfirmSuggestion = useCallback(() => {
    if (!pendingSuggestion || !pendingArgId) return;

    setArgs(prev => prev.map(a =>
      a.id === pendingArgId
        ? {
            ...a,
            clashTheme: pendingSuggestion.clash_theme || a.clashTheme,
            respondsTo: pendingSuggestion.responds_to || a.respondsTo,
            rebuttalTarget: pendingSuggestion.rebuttal_target || a.rebuttalTarget,
          }
        : a
    ));
    setPendingSuggestion(null);
    setPendingArgId(null);
  }, [pendingSuggestion, pendingArgId]);

  const handleDismissSuggestion = useCallback(() => {
    // Keep the theme but not the link
    if (pendingSuggestion && pendingArgId) {
      setArgs(prev => prev.map(a =>
        a.id === pendingArgId
          ? { ...a, clashTheme: pendingSuggestion.clash_theme || a.clashTheme }
          : a
      ));
    }
    setPendingSuggestion(null);
    setPendingArgId(null);
  }, [pendingSuggestion, pendingArgId]);

  const handleManualLink = useCallback(() => {
    setShowManualLink(true);
    setManualLinkTarget(pendingArgId);
    setPendingSuggestion(null);
  }, [pendingArgId]);

  const handleSelectLink = useCallback((targetArgId) => {
    const argToLink = manualLinkTarget || pendingArgId;
    if (argToLink) {
      const targetArg = args.find(a => a.id === targetArgId);
      setArgs(prev => prev.map(a =>
        a.id === argToLink
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
    setPendingArgId(null);
  }, [manualLinkTarget, pendingArgId, args]);

  const handleEditArg = useCallback((id, newText) => {
    setArgs(prev => prev.map(a =>
      a.id === id ? { ...a, text: newText, claim: newText } : a
    ));
  }, []);

  const handleAnnotateArg = useCallback((field, text) => {
    // Push to the array field on the most recent non-judge-note argument
    setArgs(prev => {
      const lastIdx = [...prev].reverse().findIndex(a => !a.isJudgeNote);
      if (lastIdx === -1) return prev;
      const idx = prev.length - 1 - lastIdx;
      return prev.map((a, i) =>
        i === idx ? { ...a, [field]: [...(a[field] || []), text] } : a
      );
    });
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
      // Don't intercept if typing in a textarea
      const tag = e.target.tagName;

      if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey) {
        // Let Tab navigate between textareas in the side panel
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

      // Meta/Cmd shortcuts
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
          case 'm':
            if (e.shiftKey) {
              e.preventDefault();
              setInputMode(prev => prev === 'mechanism' ? null : 'mechanism');
            }
            break;
          case 'i':
            e.preventDefault();
            setInputMode(prev => prev === 'impact' ? null : 'impact');
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
              // Link the most recent arg
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
            // Quick rank — only in adjudication mode
            break;
        }
      }

      // Enter to confirm suggestion
      if (e.key === 'Enter' && pendingSuggestion && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        handleConfirmSuggestion();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeSpeaker, speakers.length, pendingSuggestion, showManualLink,
    inputMode, showExport, args, pauseTimer, toggleTimer,
    handleConfirmSuggestion, handleDismissSuggestion, handleManualLink,
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
            onSubmitArgument={handleSubmitArgument}
            onEditArg={handleEditArg}
            onAnnotateLastArg={handleAnnotateArg}
            pendingSuggestion={pendingSuggestion}
            onConfirmSuggestion={handleConfirmSuggestion}
            onDismissSuggestion={handleDismissSuggestion}
            onManualLink={handleManualLink}
            showManualLink={showManualLink}
            onCloseManualLink={() => { setShowManualLink(false); setManualLinkTarget(null); }}
            onSelectLink={handleSelectLink}
            inputMode={inputMode}
            onClearInputMode={() => setInputMode(null)}
            judgeNotes={judgeNotes}
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
