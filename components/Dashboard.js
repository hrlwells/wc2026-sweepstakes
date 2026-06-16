'use client';

import { useState } from 'react';
import { DRAWS, ROUNDS, ROUND_SCORE, FLAGS } from '../lib/data';

const C = {
  red: '#E61D25', blue: '#2A398D', green: '#3CAC3B',
  gold: '#C8962A', dark: '#0d1117', darker: '#080c10',
  surface: '#161b24', surface2: '#1e2535',
  text: '#f0f0f0', muted: '#8a9bb5', border: 'rgba(255,255,255,0.08)',
};

const TABS = ['Leaderboard', 'All Draws', 'Top Teams', 'Regular Teams', 'Low Ranked', 'Prizes'];

function flag(t) { return FLAGS[t] || '🏳️'; }

function getStats(team, teamStats) {
  return teamStats[team] || { pts: 0, gf: 0, ga: 0, gd: 0, round: 'Group Stage', eliminated: false, fixtures: [] };
}

function getRoundScore(team, teamStats) {
  return ROUND_SCORE[getStats(team, teamStats).round] || 0;
}

// ─── SINGLE SOURCE OF TRUTH FOR SORTING ──────────────────────────────────────
// Every tab uses this so the same team always ranks the same everywhere.
// Order: furthest round → most points → best goal difference → most goals for → team name (alphabetical, final stable tiebreak)
function sortByTier(tier, teamStats) {
  return DRAWS.slice().sort((a, b) => {
    const sa = getStats(a[tier], teamStats);
    const sb = getStats(b[tier], teamStats);
    return (ROUND_SCORE[sb.round] || 0) - (ROUND_SCORE[sa.round] || 0)
      || sb.pts - sa.pts
      || sb.gd  - sa.gd
      || sb.gf  - sa.gf
      || a[tier].localeCompare(b[tier]);
  });
}

function getTeamStatus(team, teamStats) {
  const s = getStats(team, teamStats);
  const r = s.round;

  if (s.eliminated) {
    return { bg: 'rgba(230,29,37,0.07)', color: '#d06060', border: 'rgba(230,29,37,0.2)', hot: false, out: true };
  }

  if (r === 'Champion')      return { bg: 'rgba(200,150,42,0.18)',  color: C.gold,    border: 'rgba(200,150,42,0.5)',  hot: true,  out: false };
  if (r === 'Runner-up')     return { bg: 'rgba(192,192,192,0.12)', color: '#C0C0C0', border: 'rgba(192,192,192,0.4)', hot: true,  out: false };
  if (r === 'Semi-final')    return { bg: 'rgba(42,57,141,0.3)',    color: '#8BA0E8', border: 'rgba(42,57,141,0.5)',   hot: true,  out: false };
  if (r === 'Quarter-final') return { bg: 'rgba(58,172,59,0.18)',   color: '#5ed45f', border: 'rgba(58,172,59,0.45)', hot: true,  out: false };
  if (r === 'Round of 16')   return { bg: 'rgba(58,172,59,0.08)',   color: '#4ab84b', border: 'rgba(58,172,59,0.2)',  hot: false, out: false };
  if (r === 'Round of 32')   return { bg: 'rgba(255,255,255,0.04)', color: C.muted,   border: C.border,               hot: false, out: false };
  // Group Stage, not eliminated — neutral grey, no X
  return { bg: 'rgba(255,255,255,0.04)', color: C.muted, border: C.border, hot: false, out: false };
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────

function RoundPill({ team, teamStats }) {
  const r = getStats(team, teamStats).round;
  const s = getTeamStatus(team, teamStats);
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color, fontWeight: 500, whiteSpace: 'nowrap', border: `1px solid ${s.border}` }}>
      {r}
    </span>
  );
}

function SectionHead({ children }) {
  return (
    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
      {children}
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

// ─── PRIZE STRIP ──────────────────────────────────────────────────────────────

function PrizeStrip({ teamStats }) {
  const byTop     = sortByTier('top', teamStats);
  const byRegular = sortByTier('regular', teamStats);
  const byLow     = sortByTier('low', teamStats);

  const prizes = [
    { icon: '🏆', label: 'Overall winner', d: byTop[0],              team: byTop[0].top,              amount: '$200' },
    { icon: '🥈', label: 'Runner-up',      d: byTop[1] || byTop[0],  team: (byTop[1] || byTop[0]).top, amount: '$40'  },
    { icon: '⭐', label: 'Best regular',   d: byRegular[0],          team: byRegular[0].regular,       amount: '$40'  },
    { icon: '🌍', label: 'Best low ranked',d: byLow[0],              team: byLow[0].low,               amount: '$40'  },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: C.border, borderBottom: `1px solid ${C.border}` }}>
      {prizes.map(p => (
        <div key={p.label} style={{ background: C.darker, padding: '10px 12px' }}>
          <div style={{ fontSize: 14, marginBottom: 3 }}>{p.icon}</div>
          <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>{p.label}</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.d.player}</div>
          <div style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{flag(p.team)} {p.team}</div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: C.gold }}>{p.amount}</div>
        </div>
      ))}
    </div>
  );
}

// ─── FIXTURES PANEL ───────────────────────────────────────────────────────────

function FixturesPanel({ team, teamStats }) {
  const { fixtures } = getStats(team, teamStats);
  if (!fixtures || !fixtures.length) {
    return <div style={{ fontSize: 12, color: C.muted, padding: '8px 0' }}>Fixtures loading after tournament begins</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {fixtures.map((f, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', borderRadius: 7,
          background: f.upcoming ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${f.upcoming ? C.border : 'rgba(255,255,255,0.12)'}`,
          opacity: f.upcoming ? 0.85 : 1,
        }}>
          <span style={{ fontSize: 10, color: C.muted, minWidth: 70 }}>{f.date}{f.time ? ` · ${f.time}` : ''}</span>
          <span style={{ fontSize: 11, flex: 1 }}>
            {flag(team)} {team} <span style={{ color: C.muted }}>vs</span> {flag(f.opponent)} {f.opponent}
          </span>
          {f.upcoming
            ? <span style={{ fontSize: 10, color: C.muted, background: 'rgba(255,255,255,0.05)', padding: '1px 7px', borderRadius: 10 }}>Upcoming</span>
            : <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{f.score}</span>
          }
        </div>
      ))}
    </div>
  );
}

// ─── ALL DRAWS TAB ────────────────────────────────────────────────────────────

function AllDrawsTab({ teamStats, expandedTeam, onToggleTeam }) {
  const tierColors = { top: C.gold, regular: '#378ADD', low: C.green };
  const tierLabels = { top: 'Top Team', regular: 'Regular', low: 'Low Ranked' };

  return (
    <div>
      <SectionHead>All draws · tap a team row to see fixtures</SectionHead>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {DRAWS.map(d => (
          <div key={d.player} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{d.player}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {[d.top, d.regular, d.low].map(t => flag(t)).join('  ')}
              </div>
            </div>
            {[['top', d.top], ['regular', d.regular], ['low', d.low]].map(([tier, team]) => {
              const isOpen = expandedTeam === `${d.player}_${tier}`;
              return (
                <div key={tier}>
                  <div
                    onClick={() => onToggleTeam(`${d.player}_${tier}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      cursor: 'pointer', background: isOpen ? C.surface2 : 'transparent',
                      borderBottom: `1px solid ${C.border}`, transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: tierColors[tier], flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: tierColors[tier], fontWeight: 700, marginBottom: 2 }}>{tierLabels[tier]}</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{flag(team)} {team}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <RoundPill team={team} teamStats={teamStats} />
                      <span style={{ fontSize: 11, color: C.muted, display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '10px 14px', background: C.darker, borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>Fixtures & Results</div>
                      <FixturesPanel team={team} teamStats={teamStats} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LEADERBOARD TAB ──────────────────────────────────────────────────────────

function LeaderboardTab({ teamStats }) {
  const sorted    = sortByTier('top', teamStats);
  const byRegular = sortByTier('regular', teamStats);
  const byLow     = sortByTier('low', teamStats);
  const rankIn = (arr, player) => arr.findIndex(d => d.player === player);

  const prizeBadge = (rank) => {
    if (rank === 0) return { label: '1st 🥇', bg: 'rgba(255,215,0,0.18)',      color: '#FFD700' };
    if (rank === 1) return { label: '2nd 🥈', bg: 'rgba(192,192,192,0.15)',     color: '#C0C0C0' };
    if (rank === 2) return { label: '3rd 🥉', bg: 'rgba(205,127,50,0.15)',      color: '#CD7F32' };
    return               { label: `${rank + 1}th`, bg: 'rgba(255,255,255,0.05)', color: C.muted };
  };

  return (
    <div>
      {/* Prize race summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { icon: '🏆', label: 'Overall prize',    amount: '$200', d: sorted[0],    team: sorted[0].top },
          { icon: '⭐', label: 'Best regular',     amount: '$40',  d: byRegular[0], team: byRegular[0].regular },
          { icon: '🌍', label: 'Best low ranked',  amount: '$40',  d: byLow[0],     team: byLow[0].low },
        ].map(p => (
          <div key={p.label} style={{ background: C.surface, border: '1px solid rgba(200,150,42,0.25)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, marginBottom: 3 }}>{p.icon} {p.label}</div>
            <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.d.player}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{flag(p.team)} {p.team}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, marginTop: 4 }}>{p.amount}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((d) => {
          const topRank = sorted.findIndex(x => x.player === d.player);
          const regRank = rankIn(byRegular, d.player);
          const lowRank = rankIn(byLow, d.player);
          const isLeading = topRank === 0 || regRank === 0 || lowRank === 0;

          return (
            <div key={d.player} style={{ background: C.surface, border: `1px solid ${isLeading ? 'rgba(200,150,42,0.35)' : C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{d.player}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {[{ rank: topRank, icon: '🏆' }, { rank: regRank, icon: '⭐' }, { rank: lowRank, icon: '🌍' }].map(({ rank, icon }) => {
                    const b = prizeBadge(rank);
                    return (
                      <span key={icon} style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: b.bg, color: b.color, whiteSpace: 'nowrap' }}>
                        {icon} {b.label}
                      </span>
                    );
                  })}
                </div>
                {isLeading && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.gold, background: 'rgba(200,150,42,0.1)', padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Leading
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: 10 }}>
                {[['top', d.top], ['regular', d.regular], ['low', d.low]].map(([tier, team]) => {
                  const s = getTeamStatus(team, teamStats);
                  const tierColors = { top: C.gold, regular: '#378ADD', low: C.green };
                  const tierLabels = { top: 'TOP', regular: 'REG', low: 'LOW' };
                  return (
                    <div key={tier} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '8px 10px', opacity: s.out ? 0.5 : 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: tierColors[tier], textTransform: 'uppercase', letterSpacing: '0.08em' }}>{tierLabels[tier]}</span>
                        {s.hot && !s.out && <span style={{ fontSize: 9, marginLeft: 'auto' }}>🔥</span>}
                        {s.out && <span style={{ fontSize: 9, marginLeft: 'auto' }}>❌</span>}
                      </div>
                      <div style={{ fontSize: 16, marginTop: 3 }}>{flag(team)}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team}</div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: s.color, marginTop: 2 }}>{getStats(team, teamStats).round}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TIER TAB ─────────────────────────────────────────────────────────────────

function TierTab({ tier, teamStats }) {
  const label = tier === 'top' ? 'Top Teams' : tier === 'regular' ? 'Regular Teams' : 'Low Ranked Teams';
  const tierColor = tier === 'top' ? C.gold : tier === 'regular' ? '#378ADD' : C.green;

  const sorted = sortByTier(tier, teamStats);

  const rankLabel = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;

  return (
    <div>
      <SectionHead>{label}</SectionHead>
      <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 110px 60px 40px 40px 40px 28px', gap: 0, padding: '6px 10px', borderBottom: `1px solid ${C.border}` }}>
        {['', 'Player · Team', 'Stage', 'Pts', 'GF', 'GA', 'GD', ''].map((h, i) => (
          <div key={i} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.muted, fontWeight: 500, textAlign: i >= 3 ? 'center' : 'left' }}>{h}</div>
        ))}
      </div>
      {sorted.map((d, i) => {
        const team = d[tier];
        const s = getStats(team, teamStats);
        const status = getTeamStatus(team, teamStats);
        return (
          <div key={d.player} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 110px 60px 40px 40px 40px 28px', alignItems: 'center', padding: '10px 10px', borderBottom: 'rgba(255,255,255,0.04) 1px solid', background: i === 0 ? 'rgba(200,150,42,0.04)' : 'transparent' }}>
            <div style={{ fontSize: 14, textAlign: 'center' }}>{rankLabel(i)}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{d.player}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{flag(team)} {team}</div>
            </div>
            <div><RoundPill team={team} teamStats={teamStats} /></div>
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, color: tierColor }}>{s.pts}</div>
            <div style={{ textAlign: 'center', fontSize: 13 }}>{s.gf}</div>
            <div style={{ textAlign: 'center', fontSize: 13 }}>{s.ga}</div>
            <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: s.gd > 0 ? '#5ed45f' : s.gd < 0 ? '#d06060' : C.muted }}>
              {s.gd > 0 ? `+${s.gd}` : s.gd}
            </div>
            <div style={{ textAlign: 'center' }}>
              {status.hot && !status.out && <span style={{ fontSize: 12 }}>🔥</span>}
              {status.out && <span style={{ fontSize: 12 }}>❌</span>}
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 14, padding: '10px 12px', background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.7 }}>
          <strong style={{ color: C.text }}>Sorted by:</strong> Stage reached → Real tournament points (W=3, D=1, L=0) → Goal difference → Goals scored
        </div>
      </div>
    </div>
  );
}

// ─── PRIZES TAB ───────────────────────────────────────────────────────────────

function PrizesTab({ teamStats }) {
  const byTop     = sortByTier('top', teamStats);
  const byRegular = sortByTier('regular', teamStats);
  const byLow     = sortByTier('low', teamStats);
  const rankLabel = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;

  const prizes = [
    { icon: '🏆', label: 'Overall winner',       amount: '$200', color: C.gold,    arr: byTop,     tier: 'top' },
    { icon: '🥈', label: 'Runner-up',            amount: '$40',  color: '#C0C0C0', arr: byTop,     tier: 'top' },
    { icon: '⭐', label: 'Best regular team',    amount: '$40',  color: '#378ADD', arr: byRegular, tier: 'regular' },
    { icon: '🌍', label: 'Best low ranked team', amount: '$40',  color: C.green,   arr: byLow,     tier: 'low' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionHead>Prize breakdown</SectionHead>
      {prizes.map((p) => (
        <div key={p.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 20 }}>{p.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{p.label}</div>
              <div style={{ fontSize: 11, color: C.muted }}>Winner takes {p.amount}</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 900, color: p.color }}>{p.amount}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {p.arr.slice(0, 3).map((d, i) => {
              const team = d[p.tier];
              return (
                <div key={d.player} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: C.surface2, borderRadius: 8 }}>
                  <span style={{ fontSize: 12, width: 20 }}>{rankLabel(i)}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{d.player}</span>
                  <span style={{ fontSize: 12 }}>{flag(team)} {team}</span>
                  <RoundPill team={team} teamStats={teamStats} />
                  <span style={{ fontWeight: 700, color: p.color, fontSize: 12, minWidth: 28, textAlign: 'right' }}>
                    {getStats(team, teamStats).pts}pts
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>How prizes are decided</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
          <div>🏆 <strong style={{ color: C.text }}>Overall winner ($200)</strong> — player whose Top team goes furthest. Tiebreak: pts → GD → GF.</div>
          <div style={{ marginTop: 4 }}>🥈 <strong style={{ color: C.text }}>Runner-up ($40)</strong> — player whose Top team reaches the final but doesn't win.</div>
          <div style={{ marginTop: 4 }}>⭐ <strong style={{ color: C.text }}>Best Regular ($40)</strong> — player whose Regular team goes furthest. Same tiebreaks.</div>
          <div style={{ marginTop: 4 }}>🌍 <strong style={{ color: C.text }}>Best Low Ranked ($40)</strong> — player whose Low Ranked team goes furthest. Same tiebreaks.</div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, fontSize: 11 }}>
            Group stage: Win = 3pts, Draw = 1pt, Loss = 0pts. GD = goals for minus goals against.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────

export default function Dashboard({ teamStats, updatedAt }) {
  const [activeTab, setActiveTab]       = useState(0);
  const [expandedTeam, setExpandedTeam] = useState(null);

  const handleTabClick = (i) => { setActiveTab(i); setExpandedTeam(null); };
  const toggleTeam = (key) => setExpandedTeam(prev => prev === key ? null : key);

  const lastUpdated = updatedAt
    ? new Date(updatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Pre-tournament';

  return (
    <div style={{ minHeight: '100vh', background: C.dark, color: C.text, fontFamily: "'Noto Sans','Segoe UI',sans-serif" }}>

      {/* Top colour stripe */}
      <div style={{ height: 5, background: `linear-gradient(90deg, ${C.red} 33.3%, ${C.blue} 33.3%, ${C.blue} 66.6%, ${C.green} 66.6%)` }} />

      {/* Header */}
      <div style={{ background: C.darker, borderBottom: `3px solid ${C.red}`, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)', backgroundSize: '18px 18px', pointerEvents: 'none' }} />
        <div style={{ width: 48, height: 48, background: C.surface2, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0, border: `1px solid ${C.border}`, zIndex: 1 }}>🏆</div>
        <div style={{ zIndex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.1 }}>
            FIFA World Cup <span style={{ color: C.red }}>2026</span>
          </div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 2 }}>Wells & Mates · Sweepstakes</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right', zIndex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.red }}>WE ARE 26</div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>Updated {lastUpdated}</div>
        </div>
      </div>

      {/* Prize strip */}
      <PrizeStrip teamStats={teamStats} />

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.darker, borderBottom: `1px solid ${C.border}`, overflowX: 'auto' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => handleTabClick(i)} style={{
            background: 'none', border: 'none', color: activeTab === i ? C.text : C.muted,
            fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
            padding: '12px 16px', cursor: 'pointer', whiteSpace: 'nowrap',
            borderBottom: `2px solid ${activeTab === i ? C.red : 'transparent'}`,
            textTransform: 'uppercase', letterSpacing: '0.04em', transition: 'color 0.15s',
          }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 16 }}>
        {activeTab === 0 && <LeaderboardTab teamStats={teamStats} />}
        {activeTab === 1 && <AllDrawsTab teamStats={teamStats} expandedTeam={expandedTeam} onToggleTeam={toggleTeam} />}
        {activeTab === 2 && <TierTab tier="top"     teamStats={teamStats} />}
        {activeTab === 3 && <TierTab tier="regular" teamStats={teamStats} />}
        {activeTab === 4 && <TierTab tier="low"     teamStats={teamStats} />}
        {activeTab === 5 && <PrizesTab teamStats={teamStats} />}
      </div>

      <div style={{ textAlign: 'center', fontSize: 11, color: C.muted, padding: '12px 0 24px', letterSpacing: '0.06em' }}>
        FIFA World Cup 2026 · Updated daily at 5pm AEST by Claude
      </div>
    </div>
  );
}
