import { useState } from 'react';
import { TEAM_COLORS } from './constants';

export default function LandingScreen({ onStart }) {
  const [roundType, setRoundType] = useState(null);
  const [motion, setMotion] = useState('');
  const [teamNames, setTeamNames] = useState({ OG: '', OO: '', CG: '', CO: '' });
  const [infoSide, setInfoSide] = useState('');
  const handleStart = () => {
    if (!roundType) return;
    onStart({
      roundType,
      motion: motion.trim() || 'No motion specified',
      teamNames: {
        OG: teamNames.OG.trim() || 'OG',
        OO: teamNames.OO.trim() || 'OO',
        CG: teamNames.CG.trim() || 'CG',
        CO: teamNames.CO.trim() || 'CO',
      },
      infoSide,
    });
  };

  return (
    <div className="h-screen flex items-center justify-center" style={{ background: '#0f1117' }}>
      <div className="w-full max-w-xl px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1
            className="text-5xl font-bold tracking-tight mb-2"
            style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}
          >
            British Parliamentary Flow
          </h1>
          <p className="text-sm" style={{ color: '#94a3b8' }}>
            British Parliamentary Debate Flowing Tool
          </p>
        </div>

        {/* Round Type Selection */}
        {!roundType ? (
          <div className="space-y-3">
            <button
              onClick={() => setRoundType('top')}
              className="w-full p-4 rounded-lg border text-left transition-all hover:scale-[1.01]"
              style={{
                background: '#1a1d27',
                borderColor: '#2e3245',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = TEAM_COLORS.OG}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#2e3245'}
            >
              <div className="font-semibold text-lg">Top Half Round</div>
              <div className="text-sm mt-1" style={{ color: '#94a3b8' }}>
                OG vs OO — 4 speeches (PM, LO, DPM, DLO)
              </div>
            </button>
            <button
              onClick={() => setRoundType('full')}
              className="w-full p-4 rounded-lg border text-left transition-all hover:scale-[1.01]"
              style={{
                background: '#1a1d27',
                borderColor: '#2e3245',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = TEAM_COLORS.CG}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#2e3245'}
            >
              <div className="font-semibold text-lg">Full Round</div>
              <div className="text-sm mt-1" style={{ color: '#94a3b8' }}>
                All 4 teams — 8 speeches (OG, OO, CG, CO)
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-5 animate-in">
            {/* Back button */}
            <button
              onClick={() => setRoundType(null)}
              className="text-sm flex items-center gap-1 hover:opacity-80"
              style={{ color: '#94a3b8' }}
            >
              &larr; Back
            </button>

            {/* Motion */}
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                Motion
              </label>
              <input
                type="text"
                value={motion}
                onChange={e => setMotion(e.target.value)}
                placeholder="This House would..."
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors"
                style={{
                  background: '#1a1d27',
                  borderColor: '#2e3245',
                  color: '#e2e8f0',
                }}
                onFocus={e => e.target.style.borderColor = '#3B82F6'}
                onBlur={e => e.target.style.borderColor = '#2e3245'}
                autoFocus
              />
            </div>

            {/* Team Names */}
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                Team Names (optional)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['OG', 'OO', ...(roundType === 'full' ? ['CG', 'CO'] : [])].map(team => (
                  <input
                    key={team}
                    type="text"
                    value={teamNames[team]}
                    onChange={e => setTeamNames(prev => ({ ...prev, [team]: e.target.value }))}
                    placeholder={team}
                    className="px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: '#1a1d27',
                      border: `1px solid ${TEAM_COLORS[team]}33`,
                      color: '#e2e8f0',
                    }}
                    onFocus={e => e.target.style.borderColor = TEAM_COLORS[team]}
                    onBlur={e => e.target.style.borderColor = `${TEAM_COLORS[team]}33`}
                  />
                ))}
              </div>
            </div>

            {/* Info Side */}
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                Info Slide Side (optional)
              </label>
              <div className="flex gap-2">
                {['', 'Gov', 'Opp'].map(side => (
                  <button
                    key={side}
                    onClick={() => setInfoSide(side)}
                    className="px-4 py-2 rounded-lg text-sm transition-all"
                    style={{
                      background: infoSide === side ? '#2e3245' : '#1a1d27',
                      border: `1px solid ${infoSide === side ? '#94a3b8' : '#2e3245'}`,
                      color: infoSide === side ? '#e2e8f0' : '#94a3b8',
                    }}
                  >
                    {side || 'None'}
                  </button>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStart}
              className="w-full py-3 rounded-lg font-semibold text-white transition-all hover:opacity-90 mt-4"
              style={{
                background: 'linear-gradient(135deg, #3B82F6, #22C55E)',
              }}
            >
              Start Flowing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
