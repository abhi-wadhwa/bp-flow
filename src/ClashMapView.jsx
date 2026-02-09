import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { TEAM_COLORS } from './constants';

function getThemeColor(index) {
  const palette = ['#3B82F6', '#EF4444', '#22C55E', '#F59E0B', '#8B5CF6', '#06B6D4', '#EC4899', '#F97316'];
  return palette[index % palette.length];
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

    // Find root args (not responding to anything or responding to something in a different theme)
    for (const arg of nonNoteArgs) {
      if (!arg.respondsTo) {
        const theme = arg.clashTheme || 'Uncategorized';
        if (!chainMap[theme]) chainMap[theme] = [];
        const chain = [arg];
        // Find all responses
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

    // Also add standalone args that respond to something but aren't in a chain
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
        for (let i = 0; i < chain.length; i++) {
          const arg = chain[i];
          if (!positions[arg.id]) {
            positions[arg.id] = {
              x: 60 + i * 200,
              y: chainY,
            };
          }
        }
        chainY += 80;
      }

      // Standalone args in theme with no chains
      const themeArgs = themes[theme] || [];
      for (const arg of themeArgs) {
        if (!positions[arg.id]) {
          positions[arg.id] = {
            x: 60,
            y: chainY,
          };
          chainY += 80;
        }
      }

      clusterY = chainY + 40;
    }

    setNodePositions(prev => {
      // Preserve manually dragged positions
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

    // Walk up
    let current = nonNoteArgs.find(a => a.id === nodeId);
    while (current) {
      chain.add(current.id);
      if (current.respondsTo) {
        current = nonNoteArgs.find(a => a.id === current.respondsTo);
      } else {
        break;
      }
    }

    // Walk down from nodeId
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

  const totalHeight = Math.max(
    600,
    Math.max(...Object.values(nodePositions).map(p => p.y), 0) + 150
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
          {/* Theme labels */}
          {(() => {
            let labelY = 25;
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
                  {/* Theme label */}
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

          {/* Connection lines */}
          {args.filter(a => a.respondsTo && !a.isJudgeNote).map(arg => {
            const from = nodePositions[arg.respondsTo];
            const to = nodePositions[arg.id];
            if (!from || !to) return null;

            const isHighlighted = selectedChain && selectedChain.has(arg.id);
            const dimmed = selectedChain && !isHighlighted;

            return (
              <g key={`line-${arg.id}`}>
                <line
                  x1={from.x + 160}
                  y1={from.y + 20}
                  x2={to.x}
                  y2={to.y + 20}
                  stroke={isHighlighted ? '#e2e8f0' : '#2e3245'}
                  strokeWidth={isHighlighted ? 2 : 1}
                  opacity={dimmed ? 0.2 : 1}
                  markerEnd="url(#arrowhead)"
                />
              </g>
            );
          })}

          {/* Arrow marker */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#2e3245" />
            </marker>
          </defs>

          {/* Argument nodes */}
          {args.filter(a => !a.isJudgeNote).map(arg => {
            const pos = nodePositions[arg.id];
            if (!pos) return null;

            const color = TEAM_COLORS[arg.team];
            const isDropped = droppedIds.has(arg.id);
            const isHighlighted = selectedChain && selectedChain.has(arg.id);
            const dimmed = selectedChain && !isHighlighted;

            return (
              <g
                key={arg.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => handleNodeClick(arg.id)}
                onContextMenu={e => handleContextMenu(e, arg)}
                style={{ cursor: 'pointer' }}
                opacity={dimmed ? 0.25 : 1}
              >
                <rect
                  width={160}
                  height={40}
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
                  height={40}
                  rx={3}
                  fill={color}
                />
                {/* Speaker label */}
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
                {/* Badges */}
                {arg.isExtension && (
                  <text
                    x={45}
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
                    x={45}
                    y={14}
                    fill="#F59E0B"
                    fontSize="8"
                    fontFamily="DM Sans, sans-serif"
                  >
                    POI
                  </text>
                )}
                {/* Dropped indicator */}
                {isDropped && (
                  <text
                    x={140}
                    y={14}
                    fill="#EF4444"
                    fontSize="9"
                    textAnchor="end"
                  >
                    !!
                  </text>
                )}
                {/* Text */}
                <text
                  x={12}
                  y={30}
                  fill="#e2e8f0"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {arg.text.length > 22 ? arg.text.slice(0, 22) + '...' : arg.text}
                </text>
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
                fontFamily: 'JetBrains Mono, monospace',
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
