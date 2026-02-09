import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { TEAM_COLORS, REBUTTAL_COLORS } from './constants';

const NODE_W = 220;
const NODE_BASE_H = 40;
const NODE_ROW_H = 16;
const H_SPACING = 260;
const V_SPACING = 100;

function getThemeColor(index) {
  const palette = ['#3B82F6', '#EF4444', '#22C55E', '#F59E0B', '#8B5CF6', '#06B6D4', '#EC4899', '#F97316'];
  return palette[index % palette.length];
}

function getNodeHeight(arg) {
  let h = NODE_BASE_H;
  if (arg.mechanism) h += NODE_ROW_H;
  if (arg.impact) h += NODE_ROW_H;
  return h;
}

function getTargetYOffset(arg, rebuttalTarget) {
  // Returns the y offset within the node where the connection should point
  const claimY = 30; // claim row center
  if (!rebuttalTarget || rebuttalTarget === 'claim') return claimY;

  if (rebuttalTarget === 'mechanism') {
    if (arg.mechanism) return NODE_BASE_H + 8;
    return claimY; // fallback
  }

  if (rebuttalTarget === 'impact') {
    let y = NODE_BASE_H;
    if (arg.mechanism) y += NODE_ROW_H;
    if (arg.impact) return y + 8;
    return claimY; // fallback
  }

  return claimY;
}

function truncate(text, max) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

export default function ClashMapView({ arguments: args, onRetheme, onRelink }) {
  const svgRef = useRef(null);
  const [dragNode, setDragNode] = useState(null);
  const [nodePositions, setNodePositions] = useState({});
  const [selectedChain, setSelectedChain] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [renameTheme, setRenameTheme] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  // Group by clash theme
  const themes = useMemo(() => {
    const themeMap = {};
    const nonNoteArgs = args.filter(a => !a.isJudgeNote);

    for (const arg of nonNoteArgs) {
      const theme = arg.clashTheme || 'Uncategorized';
      if (!themeMap[theme]) themeMap[theme] = [];
      themeMap[theme].push(arg);
    }
    return themeMap;
  }, [args]);

  const themeNames = Object.keys(themes);

  // Build response chains
  const chains = useMemo(() => {
    const chainMap = {};
    const nonNoteArgs = args.filter(a => !a.isJudgeNote);

    for (const arg of nonNoteArgs) {
      if (!arg.respondsTo) {
        const theme = arg.clashTheme || 'Uncategorized';
        if (!chainMap[theme]) chainMap[theme] = [];
        const chain = [arg];
        let current = arg;
        const visited = new Set([arg.id]);
        while (true) {
          const resp = nonNoteArgs.find(
            a => a.respondsTo === current.id && !visited.has(a.id)
          );
          if (!resp) break;
          chain.push(resp);
          visited.add(resp.id);
          current = resp;
        }
        chainMap[theme].push(chain);
      }
    }

    for (const arg of nonNoteArgs) {
      if (arg.respondsTo) {
        const theme = arg.clashTheme || 'Uncategorized';
        const isInChain = Object.values(chainMap).some(
          chains => chains.some(chain => chain.some(a => a.id === arg.id))
        );
        if (!isInChain) {
          if (!chainMap[theme]) chainMap[theme] = [];
          chainMap[theme].push([arg]);
        }
      }
    }

    return chainMap;
  }, [args]);

  // Compute initial positions
  useEffect(() => {
    const positions = {};
    let clusterY = 40;

    for (let ti = 0; ti < themeNames.length; ti++) {
      const theme = themeNames[ti];
      const themeChains = chains[theme] || [];
      let chainY = clusterY + 50;

      for (const chain of themeChains) {
        let maxH = 0;
        for (let i = 0; i < chain.length; i++) {
          const arg = chain[i];
          const h = getNodeHeight(arg);
          if (h > maxH) maxH = h;
          if (!positions[arg.id]) {
            positions[arg.id] = {
              x: 60 + i * H_SPACING,
              y: chainY,
            };
          }
        }
        chainY += Math.max(maxH, NODE_BASE_H) + (V_SPACING - NODE_BASE_H);
      }

      // Standalone args
      const themeArgs = themes[theme] || [];
      for (const arg of themeArgs) {
        if (!positions[arg.id]) {
          positions[arg.id] = {
            x: 60,
            y: chainY,
          };
          chainY += getNodeHeight(arg) + (V_SPACING - NODE_BASE_H);
        }
      }

      clusterY = chainY + 40;
    }

    setNodePositions(prev => {
      const merged = { ...positions };
      for (const [id, pos] of Object.entries(prev)) {
        if (prev[id]?.dragged) {
          merged[id] = pos;
        }
      }
      return merged;
    });
  }, [args.length, themeNames.length]);

  // Get full chain for a node
  const getChainForNode = useCallback((nodeId) => {
    const chain = new Set();
    const nonNoteArgs = args.filter(a => !a.isJudgeNote);

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
  }, [args]);

  const handleNodeClick = (argId) => {
    if (selectedChain && selectedChain.has(argId)) {
      setSelectedChain(null);
    } else {
      setSelectedChain(getChainForNode(argId));
    }
  };

  const handleContextMenu = (e, arg) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      arg,
    });
  };

  // Determine dropped arguments
  const droppedIds = useMemo(() => {
    const nonNoteArgs = args.filter(a => !a.isJudgeNote);
    const respondedTo = new Set(nonNoteArgs.map(a => a.respondsTo).filter(Boolean));
    return new Set(
      nonNoteArgs
        .filter(a => !respondedTo.has(a.id) && !a.isJudgeNote)
        .map(a => a.id)
    );
  }, [args]);

  // Build a map from arg id to arg for quick lookups
  const argMap = useMemo(() => {
    const m = {};
    for (const a of args) m[a.id] = a;
    return m;
  }, [args]);

  const totalHeight = Math.max(
    600,
    Math.max(...Object.values(nodePositions).map(p => p.y), 0) + 200
  );

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
        <svg
          ref={svgRef}
          width="100%"
          height={totalHeight}
          style={{ minHeight: '100%' }}
        >
          {/* Arrow marker definitions - one per rebuttal type */}
          <defs>
            <marker
              id="arrow-claim"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill={REBUTTAL_COLORS.claim} />
            </marker>
            <marker
              id="arrow-mechanism"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill={REBUTTAL_COLORS.mechanism} />
            </marker>
            <marker
              id="arrow-impact"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill={REBUTTAL_COLORS.impact} />
            </marker>
            <marker
              id="arrow-default"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#2e3245" />
            </marker>
          </defs>

          {/* Theme labels */}
          {(() => {
            return themeNames.map((theme, ti) => {
              const themeArgs = themes[theme] || [];
              const positions = themeArgs
                .map(a => nodePositions[a.id])
                .filter(Boolean);
              if (positions.length === 0) return null;
              const minY = Math.min(...positions.map(p => p.y));
              const themeColor = getThemeColor(ti);

              return (
                <g key={theme}>
                  <text
                    x={16}
                    y={minY - 15}
                    fill={themeColor}
                    fontSize="12"
                    fontWeight="600"
                    fontFamily="DM Sans, sans-serif"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setRenameTheme(theme);
                      setRenameValue(theme);
                    }}
                  >
                    {theme}
                  </text>
                </g>
              );
            });
          })()}

          {/* Connection lines (curved beziers) */}
          {args.filter(a => a.respondsTo && !a.isJudgeNote).map(arg => {
            const fromPos = nodePositions[arg.respondsTo];
            const toPos = nodePositions[arg.id];
            if (!fromPos || !toPos) return null;

            const targetArg = argMap[arg.respondsTo];
            const rebuttalTarget = arg.rebuttalTarget || 'claim';
            const lineColor = REBUTTAL_COLORS[rebuttalTarget] || REBUTTAL_COLORS.claim;
            const markerId = `arrow-${rebuttalTarget in REBUTTAL_COLORS ? rebuttalTarget : 'default'}`;

            // Compute y offset for the target row
            const targetYOffset = targetArg
              ? getTargetYOffset(targetArg, rebuttalTarget)
              : 20;

            const fromNodeH = targetArg ? getNodeHeight(targetArg) : NODE_BASE_H;
            const toNodeH = getNodeHeight(arg);

            const x1 = fromPos.x + NODE_W;
            const y1 = fromPos.y + targetYOffset;
            const x2 = toPos.x;
            const y2 = toPos.y + toNodeH / 2;

            // Cubic bezier control points
            const dx = Math.abs(x2 - x1);
            const cpOffset = Math.max(40, dx * 0.35);
            const cp1x = x1 + cpOffset;
            const cp1y = y1;
            const cp2x = x2 - cpOffset;
            const cp2y = y2;

            const isHighlighted = selectedChain && selectedChain.has(arg.id);
            const dimmed = selectedChain && !isHighlighted;

            return (
              <g key={`line-${arg.id}`}>
                <path
                  d={`M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`}
                  fill="none"
                  stroke={isHighlighted ? '#e2e8f0' : lineColor}
                  strokeWidth={isHighlighted ? 2 : 1.5}
                  opacity={dimmed ? 0.15 : 0.7}
                  markerEnd={`url(#${markerId})`}
                />
              </g>
            );
          })}

          {/* Argument nodes */}
          {args.filter(a => !a.isJudgeNote).map(arg => {
            const pos = nodePositions[arg.id];
            if (!pos) return null;

            const color = TEAM_COLORS[arg.team];
            const isDropped = droppedIds.has(arg.id);
            const isHighlighted = selectedChain && selectedChain.has(arg.id);
            const dimmed = selectedChain && !isHighlighted;
            const nodeH = getNodeHeight(arg);

            const claimText = truncate(arg.claim || arg.text, 30);
            const mechText = arg.mechanism ? truncate(arg.mechanism, 28) : null;
            const impactText = arg.impact ? truncate(arg.impact, 28) : null;

            // Build tooltip text
            const tooltipParts = [arg.claim || arg.text];
            if (arg.mechanism) tooltipParts.push(`Mechanism: ${arg.mechanism}`);
            if (arg.impact) tooltipParts.push(`Impact: ${arg.impact}`);
            const tooltipText = tooltipParts.join('\n');

            return (
              <g
                key={arg.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => handleNodeClick(arg.id)}
                onContextMenu={e => handleContextMenu(e, arg)}
                style={{ cursor: 'pointer' }}
                opacity={dimmed ? 0.25 : 1}
              >
                <title>{tooltipText}</title>

                {/* Node background */}
                <rect
                  width={NODE_W}
                  height={nodeH}
                  rx={6}
                  fill="#222533"
                  stroke={isHighlighted ? '#e2e8f0' : color}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeDasharray={isDropped ? '4,2' : undefined}
                />
                {/* Team color left bar */}
                <rect
                  x={0}
                  y={0}
                  width={4}
                  height={nodeH}
                  rx={3}
                  fill={color}
                />

                {/* Header row: Speaker + badges */}
                <text
                  x={12}
                  y={14}
                  fill={color}
                  fontSize="9"
                  fontWeight="700"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {arg.speaker}
                </text>
                {arg.isExtension && (
                  <text
                    x={50}
                    y={14}
                    fill="#8B5CF6"
                    fontSize="8"
                    fontFamily="DM Sans, sans-serif"
                  >
                    EXT
                  </text>
                )}
                {arg.isPOI && (
                  <text
                    x={50}
                    y={14}
                    fill="#F59E0B"
                    fontSize="8"
                    fontFamily="DM Sans, sans-serif"
                  >
                    POI
                  </text>
                )}
                {isDropped && (
                  <text
                    x={NODE_W - 12}
                    y={14}
                    fill="#EF4444"
                    fontSize="9"
                    textAnchor="end"
                  >
                    !!
                  </text>
                )}

                {/* Claim row (white) */}
                <text
                  x={12}
                  y={30}
                  fill="#e2e8f0"
                  fontSize="10"
                  fontFamily="Inter, sans-serif"
                >
                  {claimText}
                </text>

                {/* Mechanism row (green) */}
                {mechText && (
                  <text
                    x={12}
                    y={NODE_BASE_H + 12}
                    fill={REBUTTAL_COLORS.mechanism}
                    fontSize="9"
                    fontFamily="Inter, sans-serif"
                  >
                    <tspan fontWeight="600">M: </tspan>
                    {mechText}
                  </text>
                )}

                {/* Impact row (rose) */}
                {impactText && (
                  <text
                    x={12}
                    y={NODE_BASE_H + (arg.mechanism ? NODE_ROW_H : 0) + 12}
                    fill={REBUTTAL_COLORS.impact}
                    fontSize="9"
                    fontFamily="Inter, sans-serif"
                  >
                    <tspan fontWeight="600">I: </tspan>
                    {impactText}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
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
