import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { TEAM_COLORS, REBUTTAL_COLORS, FULL_ROUND_SPEAKERS } from './constants';
import { computeDroppedIds, estimateNodeHeight, GOV_TEAMS, OPP_TEAMS } from './flowAnalysis';
import { analyzeClashFlow } from './classifier';

const NODE_W = 320;
const COL_GAP = 120;      // gap between gov and opp columns
const THEME_GAP = 60;     // vertical gap between theme clusters
const NODE_V_GAP = 16;    // vertical gap between nodes in a column
const THEME_HEADER_H = 40;
const SIDE_PADDING = 40;

// Speech order lookup
const SPEECH_ORDER = {};
for (const sp of FULL_ROUND_SPEAKERS) {
  SPEECH_ORDER[sp.role] = sp.order;
}

function getThemeColor(index) {
  const palette = ['#3B82F6', '#EF4444', '#22C55E', '#F59E0B', '#8B5CF6', '#06B6D4', '#EC4899', '#F97316'];
  return palette[index % palette.length];
}

const INTERACTION_COLORS = {
  strong_rebuttal: '#22C55E',
  effectively_answered: '#3B82F6',
  weak_response: '#F59E0B',
  tangential: '#EF4444',
};

const INTERACTION_LABELS = {
  strong_rebuttal: 'Strong',
  effectively_answered: 'Answered',
  weak_response: 'Weak',
  tangential: 'Tangential',
};

function getSide(team) {
  if (GOV_TEAMS.has(team)) return 'gov';
  if (OPP_TEAMS.has(team)) return 'opp';
  return 'gov';
}

export default function ClashMapView({ arguments: args, onRetheme, onRelink }) {
  const svgRef = useRef(null);
  const [selectedChain, setSelectedChain] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [renameTheme, setRenameTheme] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  // Filter non-note args
  const nonNoteArgs = useMemo(() => args.filter(a => !a.isJudgeNote), [args]);

  // Group by clash theme
  const themes = useMemo(() => {
    const themeMap = {};
    for (const arg of nonNoteArgs) {
      const theme = arg.clashTheme || 'Uncategorized';
      if (!themeMap[theme]) themeMap[theme] = [];
      themeMap[theme].push(arg);
    }
    return themeMap;
  }, [nonNoteArgs]);

  const themeNames = Object.keys(themes);

  // Correct dropped detection
  const droppedIds = useMemo(() => computeDroppedIds(args), [args]);

  // Build argMap for quick lookup
  const argMap = useMemo(() => {
    const m = {};
    for (const a of args) m[a.id] = a;
    return m;
  }, [args]);

  // Build interaction label lookup from AI analysis
  const interactionLabelMap = useMemo(() => {
    if (!aiAnalysis?.interaction_labels) return {};
    const m = {};
    for (const il of aiAnalysis.interaction_labels) {
      m[il.responder_id] = il;
    }
    return m;
  }, [aiAnalysis]);

  // Theme verdict lookup
  const themeVerdictMap = useMemo(() => {
    if (!aiAnalysis?.theme_verdicts) return {};
    const m = {};
    for (const tv of aiAnalysis.theme_verdicts) {
      m[tv.theme] = tv;
    }
    return m;
  }, [aiAnalysis]);

  // Compute layout: gov-left, opp-right per theme
  const layout = useMemo(() => {
    const nodePositions = {};
    const themeBounds = {};
    let currentY = SIDE_PADDING;

    const govColX = SIDE_PADDING;
    const oppColX = SIDE_PADDING + NODE_W + COL_GAP;

    for (let ti = 0; ti < themeNames.length; ti++) {
      const theme = themeNames[ti];
      const themeArgs = themes[theme] || [];
      const themeStartY = currentY;

      // Split into gov and opp, sorted by speech order
      const govArgs = themeArgs
        .filter(a => getSide(a.team) === 'gov')
        .sort((a, b) => (SPEECH_ORDER[a.speaker] || 0) - (SPEECH_ORDER[b.speaker] || 0));
      const oppArgs = themeArgs
        .filter(a => getSide(a.team) === 'opp')
        .sort((a, b) => (SPEECH_ORDER[a.speaker] || 0) - (SPEECH_ORDER[b.speaker] || 0));

      // Layout gov column
      let govY = themeStartY + THEME_HEADER_H;
      for (const arg of govArgs) {
        const h = estimateNodeHeight(arg);
        nodePositions[arg.id] = { x: govColX, y: govY, h };
        govY += h + NODE_V_GAP;
      }

      // Layout opp column
      let oppY = themeStartY + THEME_HEADER_H;
      for (const arg of oppArgs) {
        const h = estimateNodeHeight(arg);
        nodePositions[arg.id] = { x: oppColX, y: oppY, h };
        oppY += h + NODE_V_GAP;
      }

      const clusterBottom = Math.max(govY, oppY);
      themeBounds[theme] = {
        top: themeStartY,
        bottom: clusterBottom,
        themeIndex: ti,
      };

      currentY = clusterBottom + THEME_GAP;
    }

    return { nodePositions, themeBounds, totalHeight: currentY + 100 };
  }, [themeNames, themes]);

  const { nodePositions, themeBounds, totalHeight } = layout;

  // Chain highlighting
  const getChainForNode = useCallback((nodeId) => {
    const chain = new Set();
    let current = nonNoteArgs.find(a => a.id === nodeId);
    while (current) {
      chain.add(current.id);
      if (current.respondsTo) {
        current = nonNoteArgs.find(a => a.id === current.respondsTo);
      } else {
        break;
      }
    }
    current = nonNoteArgs.find(a => a.id === nodeId);
    const queue = [current];
    while (queue.length > 0) {
      const node = queue.shift();
      chain.add(node.id);
      const responses = nonNoteArgs.filter(a => a.respondsTo === node.id);
      for (const r of responses) {
        if (!chain.has(r.id)) {
          queue.push(r);
        }
      }
    }
    return chain;
  }, [nonNoteArgs]);

  const handleNodeClick = (argId) => {
    if (selectedChain && selectedChain.has(argId)) {
      setSelectedChain(null);
    } else {
      setSelectedChain(getChainForNode(argId));
    }
  };

  const handleContextMenu = (e, arg) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, arg });
  };

  const handleAnalyzeFlow = async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await analyzeClashFlow(args, themeNames);
      setAiAnalysis(result);
    } catch (e) {
      console.error('Flow analysis failed:', e);
      setAnalysisError(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const svgWidth = SIDE_PADDING * 2 + NODE_W * 2 + COL_GAP;

  return (
    <div className="h-full overflow-auto relative" onClick={() => setContextMenu(null)}>
      {themeNames.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center" style={{ color: '#2e3245' }}>
            <div className="text-4xl mb-2">&#9673;</div>
            <div className="text-sm">Start flowing to see the clash map</div>
          </div>
        </div>
      ) : (
        <>
          {/* Top bar: Analyze button + overall assessment */}
          <div
            className="sticky top-0 z-10 px-4 py-2 flex items-center gap-3 border-b"
            style={{ background: '#0f1117', borderColor: '#2e3245' }}
          >
            <button
              onClick={handleAnalyzeFlow}
              disabled={analyzing}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
              style={{
                background: analyzing ? '#2e3245' : '#3B82F6',
                color: analyzing ? '#94a3b8' : '#fff',
                cursor: analyzing ? 'wait' : 'pointer',
              }}
            >
              {analyzing ? 'Analyzing...' : 'Analyze Flow'}
            </button>
            {analysisError && (
              <span className="text-xs" style={{ color: '#EF4444' }}>
                {analysisError}
              </span>
            )}
            {aiAnalysis?.overall_assessment && (
              <div
                className="flex-1 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: '#1a1d27', color: '#e2e8f0' }}
              >
                {aiAnalysis.overall_assessment}
              </div>
            )}
          </div>

          <svg
            ref={svgRef}
            width={svgWidth}
            height={Math.max(600, totalHeight)}
            style={{ minHeight: '100%' }}
          >
            {/* Arrow marker definitions */}
            <defs>
              {['claim', 'mechanism', 'impact', 'default'].map(type => (
                <marker
                  key={type}
                  id={`arrow-${type}`}
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 8 3, 0 6"
                    fill={REBUTTAL_COLORS[type] || '#2e3245'}
                  />
                </marker>
              ))}
            </defs>

            {/* Theme clusters */}
            {themeNames.map((theme, ti) => {
              const bounds = themeBounds[theme];
              if (!bounds) return null;
              const themeColor = getThemeColor(ti);
              const verdict = themeVerdictMap[theme];

              return (
                <g key={`theme-${theme}`}>
                  {/* Background rect for theme cluster */}
                  <rect
                    x={SIDE_PADDING - 12}
                    y={bounds.top - 4}
                    width={NODE_W * 2 + COL_GAP + 24}
                    height={bounds.bottom - bounds.top + 8}
                    rx={8}
                    fill={`${themeColor}08`}
                    stroke={`${themeColor}20`}
                    strokeWidth={1}
                  />

                  {/* Theme header label */}
                  <text
                    x={SIDE_PADDING}
                    y={bounds.top + 14}
                    fill={themeColor}
                    fontSize="13"
                    fontWeight="700"
                    fontFamily="DM Sans, sans-serif"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setRenameTheme(theme);
                      setRenameValue(theme);
                    }}
                  >
                    {theme}
                  </text>

                  {/* Column labels */}
                  <text
                    x={SIDE_PADDING + NODE_W / 2}
                    y={bounds.top + 14}
                    fill="#3B82F6"
                    fontSize="9"
                    fontWeight="600"
                    fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                    opacity={0.5}
                  >
                    GOV
                  </text>
                  <text
                    x={SIDE_PADDING + NODE_W + COL_GAP + NODE_W / 2}
                    y={bounds.top + 14}
                    fill="#EF4444"
                    fontSize="9"
                    fontWeight="600"
                    fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                    opacity={0.5}
                  >
                    OPP
                  </text>

                  {/* Theme verdict badge (from AI analysis) */}
                  {verdict && (
                    <foreignObject
                      x={SIDE_PADDING + NODE_W + (COL_GAP - 100) / 2}
                      y={bounds.bottom - 4}
                      width={100}
                      height={44}
                    >
                      <div
                        xmlns="http://www.w3.org/1999/xhtml"
                        style={{
                          background: verdict.winning_side === 'gov' ? '#3B82F620' :
                                     verdict.winning_side === 'opp' ? '#EF444420' : '#94a3b820',
                          border: `1px solid ${verdict.winning_side === 'gov' ? '#3B82F640' :
                                                verdict.winning_side === 'opp' ? '#EF444440' : '#94a3b840'}`,
                          borderRadius: '6px',
                          padding: '4px 8px',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: verdict.winning_side === 'gov' ? '#3B82F6' :
                                 verdict.winning_side === 'opp' ? '#EF4444' : '#94a3b8',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}>
                          {verdict.winning_side.toUpperCase()}
                        </div>
                        <div style={{
                          fontSize: '8px',
                          color: '#94a3b8',
                          fontFamily: 'Inter, sans-serif',
                          marginTop: '1px',
                          lineHeight: '1.2',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}>
                          {verdict.explanation}
                        </div>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}

            {/* Connection lines (curved beziers) */}
            {nonNoteArgs.filter(a => a.respondsTo).map(arg => {
              const fromPos = nodePositions[arg.respondsTo];
              const toPos = nodePositions[arg.id];
              if (!fromPos || !toPos) return null;

              const rebuttalTarget = arg.rebuttalTarget || 'claim';
              const lineColor = REBUTTAL_COLORS[rebuttalTarget] || REBUTTAL_COLORS.claim;
              const markerId = `arrow-${rebuttalTarget in REBUTTAL_COLORS ? rebuttalTarget : 'default'}`;

              // Determine direction: gov→opp or opp→gov
              const fromIsGov = fromPos.x < toPos.x;
              const x1 = fromIsGov ? fromPos.x + NODE_W : fromPos.x;
              const y1 = fromPos.y + (fromPos.h || 40) / 2;
              const x2 = fromIsGov ? toPos.x : toPos.x + NODE_W;
              const y2 = toPos.y + (toPos.h || 40) / 2;

              const dx = Math.abs(x2 - x1);
              const cpOffset = Math.max(40, dx * 0.35);
              const cp1x = fromIsGov ? x1 + cpOffset : x1 - cpOffset;
              const cp2x = fromIsGov ? x2 - cpOffset : x2 + cpOffset;

              const isHighlighted = selectedChain && selectedChain.has(arg.id);
              const dimmed = selectedChain && !isHighlighted;

              // Interaction label from AI analysis
              const interaction = interactionLabelMap[arg.id];
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              return (
                <g key={`line-${arg.id}`}>
                  <path
                    d={`M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={isHighlighted ? '#e2e8f0' : lineColor}
                    strokeWidth={isHighlighted ? 2 : 1.5}
                    opacity={dimmed ? 0.15 : 0.7}
                    markerEnd={`url(#${markerId})`}
                  />
                  {/* Interaction quality pill */}
                  {interaction && !dimmed && (
                    <foreignObject
                      x={midX - 32}
                      y={midY - 10}
                      width={64}
                      height={20}
                    >
                      <div
                        xmlns="http://www.w3.org/1999/xhtml"
                        title={interaction.reason}
                        style={{
                          background: `${INTERACTION_COLORS[interaction.label] || '#94a3b8'}25`,
                          border: `1px solid ${INTERACTION_COLORS[interaction.label] || '#94a3b8'}50`,
                          borderRadius: '10px',
                          padding: '1px 6px',
                          fontSize: '8px',
                          fontWeight: 600,
                          color: INTERACTION_COLORS[interaction.label] || '#94a3b8',
                          fontFamily: 'JetBrains Mono, monospace',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          cursor: 'help',
                        }}
                      >
                        {INTERACTION_LABELS[interaction.label] || interaction.label}
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}

            {/* Argument nodes using foreignObject for word-wrapped HTML */}
            {nonNoteArgs.map(arg => {
              const pos = nodePositions[arg.id];
              if (!pos) return null;

              const color = TEAM_COLORS[arg.team];
              const isDropped = droppedIds.has(arg.id);
              const isHighlighted = selectedChain && selectedChain.has(arg.id);
              const dimmed = selectedChain && !isHighlighted;
              const nodeH = pos.h || estimateNodeHeight(arg);

              const mechs = arg.mechanisms || (arg.mechanism ? [arg.mechanism] : []);
              const imps = arg.impacts || (arg.impact ? [arg.impact] : []);
              const refs = arg.refutations || [];

              return (
                <g
                  key={arg.id}
                  opacity={dimmed ? 0.25 : 1}
                >
                  <foreignObject
                    x={pos.x}
                    y={pos.y}
                    width={NODE_W}
                    height={nodeH}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleNodeClick(arg.id)}
                    onContextMenu={e => handleContextMenu(e, arg)}
                  >
                    <div
                      xmlns="http://www.w3.org/1999/xhtml"
                      style={{
                        width: NODE_W,
                        height: nodeH,
                        background: '#222533',
                        border: `${isHighlighted ? 2 : 1}px ${isDropped ? 'dashed' : 'solid'} ${isHighlighted ? '#e2e8f0' : color}`,
                        borderRadius: '6px',
                        borderLeft: `4px solid ${color}`,
                        overflow: 'hidden',
                        fontFamily: 'Inter, sans-serif',
                        padding: '0',
                        boxSizing: 'border-box',
                      }}
                    >
                      {/* Header */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px 2px',
                      }}>
                        <span style={{
                          color,
                          fontSize: '9px',
                          fontWeight: 700,
                          fontFamily: 'JetBrains Mono, monospace',
                        }}>
                          {arg.speaker}
                        </span>
                        {arg.isExtension && (
                          <span style={{ color: '#8B5CF6', fontSize: '8px' }}>EXT</span>
                        )}
                        {arg.isPOI && (
                          <span style={{ color: '#F59E0B', fontSize: '8px' }}>POI</span>
                        )}
                        <span style={{ flex: 1 }} />
                        {isDropped && (
                          <span style={{ color: '#EF4444', fontSize: '9px', fontWeight: 700 }}>!!</span>
                        )}
                      </div>

                      {/* Claim - full text, word-wrapped */}
                      <div style={{
                        padding: '2px 8px 4px',
                        color: '#e2e8f0',
                        fontSize: '11px',
                        lineHeight: '1.4',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                      }}>
                        {arg.claim || arg.text}
                      </div>

                      {/* Mechanisms - ALL shown */}
                      {mechs.map((m, mi) => (
                        <div key={`m-${mi}`} style={{
                          padding: '1px 8px',
                          color: REBUTTAL_COLORS.mechanism,
                          fontSize: '10px',
                          lineHeight: '1.3',
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word',
                        }}>
                          <span style={{ fontWeight: 600 }}>M: </span>{m}
                        </div>
                      ))}

                      {/* Impacts - ALL shown */}
                      {imps.map((imp, ii) => (
                        <div key={`i-${ii}`} style={{
                          padding: '1px 8px',
                          color: REBUTTAL_COLORS.impact,
                          fontSize: '10px',
                          lineHeight: '1.3',
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word',
                        }}>
                          <span style={{ fontWeight: 600 }}>I: </span>{imp}
                        </div>
                      ))}

                      {/* Refutations - ALL shown */}
                      {refs.map((r, ri) => (
                        <div key={`r-${ri}`} style={{
                          padding: '1px 8px',
                          color: '#F59E0B',
                          fontSize: '10px',
                          lineHeight: '1.3',
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word',
                        }}>
                          <span style={{ fontWeight: 600 }}>R: </span>{r}
                        </div>
                      ))}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        </>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded-lg border overflow-hidden"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            background: '#1a1d27',
            borderColor: '#2e3245',
          }}
        >
          <button
            className="block w-full text-left px-4 py-2 text-xs hover:bg-white/5 transition-colors"
            style={{ color: '#e2e8f0' }}
            onClick={() => {
              setRenameTheme(contextMenu.arg.clashTheme);
              setRenameValue(contextMenu.arg.clashTheme || '');
              setContextMenu(null);
            }}
          >
            Re-assign clash theme
          </button>
          <button
            className="block w-full text-left px-4 py-2 text-xs hover:bg-white/5 transition-colors"
            style={{ color: '#e2e8f0' }}
            onClick={() => {
              onRelink(contextMenu.arg.id);
              setContextMenu(null);
            }}
          >
            Re-link to different argument
          </button>
        </div>
      )}

      {/* Theme rename modal */}
      {renameTheme && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setRenameTheme(null)}
        >
          <div
            className="p-4 rounded-xl border"
            style={{ background: '#1a1d27', borderColor: '#2e3245' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-xs font-medium mb-2" style={{ color: '#94a3b8' }}>
              Rename theme: {renameTheme}
            </div>
            <input
              type="text"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && renameValue.trim()) {
                  onRetheme(renameTheme, renameValue.trim());
                  setRenameTheme(null);
                }
                if (e.key === 'Escape') setRenameTheme(null);
              }}
              className="w-64 px-3 py-2 rounded-lg border text-sm outline-none"
              style={{
                background: '#222533',
                borderColor: '#2e3245',
                color: '#e2e8f0',
              }}
              autoFocus
            />
            <div className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>
              Press Enter to confirm, Esc to cancel
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
