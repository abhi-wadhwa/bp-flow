import { useState, useMemo } from 'react';
import { TEAM_COLORS } from './constants';
import { computeDroppedIds } from './flowAnalysis';

function TeamRankSlot({ rank, team, teamName, color, onDrop, onDragStart }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg border transition-all"
      style={{
        background: team ? `${color}11` : '#1a1d27',
        borderColor: dragOver ? '#e2e8f0' : team ? `${color}44` : '#2e3245',
      }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        const draggedTeam = e.dataTransfer.getData('team');
        if (draggedTeam) onDrop(draggedTeam, rank);
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
        style={{
          background: rank === 1 ? '#F59E0B33' : rank === 2 ? '#94a3b833' : rank === 3 ? '#78350F33' : '#2e3245',
          color: rank === 1 ? '#F59E0B' : rank === 2 ? '#94a3b8' : rank === 3 ? '#D97706' : '#64748b',
        }}
      >
        {rank}
      </div>
      {team ? (
        <div
          className="flex-1 cursor-grab active:cursor-grabbing"
          draggable
          onDragStart={e => {
            e.dataTransfer.setData('team', team);
            onDragStart(team);
          }}
        >
          <div className="font-semibold text-sm" style={{ color }}>
            {teamName}
          </div>
          <div className="text-[10px]" style={{ color: '#94a3b8' }}>{team}</div>
        </div>
      ) : (
        <div className="flex-1 text-xs" style={{ color: '#2e3245' }}>
          Drop team here
        </div>
      )}
    </div>
  );
}

export default function AdjudicationPanel({
  speakers,
  teamNames,
  arguments: args,
  roundType,
  onBack,
}) {
  const teams = roundType === 'full'
    ? ['OG', 'OO', 'CG', 'CO']
    : ['OG', 'OO'];

  const [rankings, setRankings] = useState(() => {
    const r = {};
    teams.forEach((t, i) => { r[i + 1] = t; });
    return r;
  });

  const [scores, setScores] = useState(() => {
    const s = {};
    speakers.forEach(sp => { s[sp.role] = 75; });
    return s;
  });

  const [rfds, setRfds] = useState(() => {
    const r = {};
    teams.forEach(t => { r[t] = ''; });
    return r;
  });

  const handleDrop = (team, targetRank) => {
    setRankings(prev => {
      const newRankings = { ...prev };
      // Find where the team currently is
      const currentRank = Object.entries(newRankings).find(([, t]) => t === team)?.[0];
      // Find what's currently in the target
      const targetTeam = newRankings[targetRank];

      if (currentRank) {
        newRankings[currentRank] = targetTeam || null;
      }
      newRankings[targetRank] = team;
      return newRankings;
    });
  };

  // Dropped arguments (using shared logic that skips POIs/extensions/weighing)
  const droppedArgs = useMemo(() => {
    const droppedIds = computeDroppedIds(args);
    return args.filter(a => droppedIds.has(a.id));
  }, [args]);

  const droppedByTeam = useMemo(() => {
    const byTeam = {};
    teams.forEach(t => { byTeam[t] = []; });
    for (const arg of droppedArgs) {
      if (byTeam[arg.team]) {
        byTeam[arg.team].push(arg);
      }
    }
    return byTeam;
  }, [droppedArgs, teams]);

  // Clash summaries
  const clashSummary = useMemo(() => {
    const nonNoteArgs = args.filter(a => !a.isJudgeNote);
    const themes = {};
    for (const arg of nonNoteArgs) {
      const theme = arg.clashTheme || 'Uncategorized';
      if (!themes[theme]) themes[theme] = { teams: {}, total: 0 };
      themes[theme].total++;
      if (!themes[theme].teams[arg.team]) {
        themes[theme].teams[arg.team] = 0;
      }
      themes[theme].teams[arg.team]++;
    }
    return themes;
  }, [args]);

  // Team average scores
  const teamAverages = useMemo(() => {
    const avgs = {};
    for (const team of teams) {
      const teamSpeakers = speakers.filter(s => s.team === team);
      const total = teamSpeakers.reduce((sum, sp) => sum + (scores[sp.role] || 75), 0);
      avgs[team] = (total / teamSpeakers.length).toFixed(1);
    }
    return avgs;
  }, [scores, speakers, teams]);

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#0f1117' }}>
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold" style={{ letterSpacing: '-0.02em' }}>
              Adjudication
            </h2>
            <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
              Rank teams, score speakers, and write your RFD
            </p>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ background: '#2e3245', color: '#e2e8f0' }}
          >
            Back to Flow
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: Rankings + Scores */}
          <div className="space-y-6">
            {/* Team Rankings */}
            <div>
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-3"
                style={{ color: '#94a3b8' }}
              >
                Team Rankings
              </h3>
              <div className="space-y-2">
                {[1, 2, 3, 4].slice(0, teams.length).map(rank => {
                  const team = rankings[rank];
                  return (
                    <TeamRankSlot
                      key={rank}
                      rank={rank}
                      team={team}
                      teamName={team ? teamNames[team] : ''}
                      color={team ? TEAM_COLORS[team] : '#2e3245'}
                      onDrop={handleDrop}
                      onDragStart={() => {}}
                    />
                  );
                })}
              </div>
            </div>

            {/* Speaker Scores */}
            <div>
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-3"
                style={{ color: '#94a3b8' }}
              >
                Speaker Scores
              </h3>
              <div className="space-y-2">
                {speakers.map(sp => (
                  <div
                    key={sp.role}
                    className="flex items-center gap-3 p-2 rounded-lg"
                    style={{ background: '#1a1d27' }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: TEAM_COLORS[sp.team] }}
                    />
                    <span
                      className="text-xs font-medium flex-shrink-0 w-10"
                      style={{ fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      {sp.role}
                    </span>
                    <input
                      type="range"
                      min={50}
                      max={100}
                      value={scores[sp.role]}
                      onChange={e => setScores(prev => ({ ...prev, [sp.role]: Number(e.target.value) }))}
                      className="flex-1"
                      style={{ accentColor: TEAM_COLORS[sp.team] }}
                    />
                    <input
                      type="number"
                      min={50}
                      max={100}
                      value={scores[sp.role]}
                      onChange={e => {
                        const v = Math.max(50, Math.min(100, Number(e.target.value)));
                        setScores(prev => ({ ...prev, [sp.role]: v }));
                      }}
                      className="w-12 text-center rounded px-1 py-0.5 text-xs outline-none"
                      style={{
                        background: '#222533',
                        color: '#e2e8f0',
                        fontFamily: 'JetBrains Mono, monospace',
                        border: 'none',
                      }}
                    />
                  </div>
                ))}
                {/* Team averages */}
                <div className="pt-2 border-t mt-2 space-y-1" style={{ borderColor: '#2e3245' }}>
                  {teams.map(team => (
                    <div key={team} className="flex items-center justify-between text-xs">
                      <span style={{ color: TEAM_COLORS[team] }}>{teamNames[team]} avg</span>
                      <span
                        className="font-bold"
                        style={{ fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}
                      >
                        {teamAverages[team]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: RFD + Summaries */}
          <div className="space-y-6">
            {/* RFD */}
            <div>
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-3"
                style={{ color: '#94a3b8' }}
              >
                Reason for Decision
              </h3>
              <div className="space-y-3">
                {teams.map((team, i) => {
                  const rank = Object.entries(rankings).find(([, t]) => t === team)?.[0];
                  return (
                    <div key={team}>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
                          style={{
                            background: `${TEAM_COLORS[team]}22`,
                            color: TEAM_COLORS[team],
                          }}
                        >
                          {rank || '?'}
                        </span>
                        <span className="text-xs font-medium" style={{ color: TEAM_COLORS[team] }}>
                          {teamNames[team]}
                        </span>
                      </div>
                      <textarea
                        value={rfds[team]}
                        onChange={e => setRfds(prev => ({ ...prev, [team]: e.target.value }))}
                        placeholder={`Why ${teamNames[team]} placed ${rank ? ordinal(Number(rank)) : '...'}...`}
                        className="w-full h-24 px-3 py-2 rounded-lg border text-xs outline-none resize-none"
                        style={{
                          background: '#1a1d27',
                          borderColor: '#2e3245',
                          color: '#e2e8f0',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dropped Arguments */}
            <div>
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-3"
                style={{ color: '#EF4444' }}
              >
                Dropped Arguments
              </h3>
              {Object.entries(droppedByTeam).map(([team, dropped]) => (
                <div key={team} className="mb-3">
                  <div className="text-xs font-medium mb-1" style={{ color: TEAM_COLORS[team] }}>
                    {teamNames[team]} ({dropped.length} unanswered)
                  </div>
                  {dropped.length === 0 ? (
                    <div className="text-[10px]" style={{ color: '#2e3245' }}>None</div>
                  ) : (
                    <div className="space-y-1">
                      {dropped.map(arg => (
                        <div
                          key={arg.id}
                          className="text-[10px] px-2 py-1 rounded"
                          style={{
                            background: '#1a1d27',
                            color: '#94a3b8',
                            borderLeft: `2px solid ${TEAM_COLORS[team]}`,
                          }}
                        >
                          {arg.speaker}: {arg.claim || arg.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Clash Summary */}
            <div>
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-3"
                style={{ color: '#94a3b8' }}
              >
                Clash Summary
              </h3>
              {Object.entries(clashSummary).map(([theme, data]) => (
                <div
                  key={theme}
                  className="mb-3 p-3 rounded-lg"
                  style={{ background: '#1a1d27' }}
                >
                  <div className="text-xs font-semibold mb-2" style={{ color: '#e2e8f0' }}>
                    {theme}
                    <span className="ml-2 text-[10px] font-normal" style={{ color: '#94a3b8' }}>
                      ({data.total} arguments)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {Object.entries(data.teams).map(([team, count]) => (
                      <div
                        key={team}
                        className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px]"
                        style={{
                          background: `${TEAM_COLORS[team]}15`,
                          color: TEAM_COLORS[team],
                        }}
                      >
                        <span className="font-bold">{teamNames[team]}</span>
                        <span>{count}</span>
                        <div
                          className="h-1 rounded-full"
                          style={{
                            width: `${(count / data.total) * 40}px`,
                            background: TEAM_COLORS[team],
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
