#!/usr/bin/env node
/**
 * WC2026 Sweepstakes — Daily Update Script (football-data.org version)
 * ====================================================================
 * Runs via GitHub Actions daily. Pulls World Cup data directly from
 * football-data.org's free API — no AI, no web search, $0 per run.
 *
 * Required environment variables:
 *   FOOTBALL_DATA_API_KEY      — your football-data.org API token
 *   NEXT_PUBLIC_SUPABASE_URL   — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — Supabase service role key (write access)
 */

import { createClient } from '@supabase/supabase-js';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const ALL_TEAMS = [
  "Spain","Canada","Iran","Brazil","Ecuador","Cape Verde",
  "Mexico","Ivory Coast","Jordan","Belgium","Türkiye","New Zealand",
  "USA","Egypt","Iraq","Colombia","Algeria","Qatar",
  "Germany","Croatia","Saudi Arabia","Japan","Czechia","DR Congo",
  "France","Sweden","Curacao","England","South Korea","South Africa",
  "Norway","Austria","Haiti","Netherlands","Senegal","Uzbekistan",
  "Argentina","Uruguay","Scotland","Morocco","Paraguay","Tunisia",
  "Portugal","Bosnia & Herzegovina","Panama","Switzerland","Ghana","Australia",
];

const ROUNDS = ["Group Stage","Round of 32","Round of 16","Quarter-final","Semi-final","Runner-up","Champion"];

// Map football-data.org team names → our team names.
// Add/adjust entries here if the logs report a name we couldn't match.
const NAME_MAP = {
  "United States": "USA",
  "United States of America": "USA",
  "Türkiye": "Türkiye",
  "Turkey": "Türkiye",
  "Côte d'Ivoire": "Ivory Coast",
  "Ivory Coast": "Ivory Coast",
  "Korea Republic": "South Korea",
  "South Korea": "South Korea",
  "IR Iran": "Iran",
  "Iran": "Iran",
  "Czech Republic": "Czechia",
  "Czechia": "Czechia",
  "DR Congo": "DR Congo",
  "Congo DR": "DR Congo",
  "Democratic Republic of Congo": "DR Congo",
  "Bosnia and Herzegovina": "Bosnia & Herzegovina",
  "Bosnia & Herzegovina": "Bosnia & Herzegovina",
  "Curaçao": "Curacao",
  "Curacao": "Curacao",
  "Cabo Verde": "Cape Verde",
  "Cape Verde": "Cape Verde",
};

// Map football-data.org knockout stage names → our round labels
const STAGE_MAP = {
  "GROUP_STAGE": "Group Stage",
  "LAST_32": "Round of 32",
  "ROUND_OF_32": "Round of 32",
  "LAST_16": "Round of 16",
  "ROUND_OF_16": "Round of 16",
  "QUARTER_FINALS": "Quarter-final",
  "QUARTER_FINAL": "Quarter-final",
  "SEMI_FINALS": "Semi-final",
  "SEMI_FINAL": "Semi-final",
  "THIRD_PLACE": "Semi-final",
  "FINAL": "Runner-up", // finalists are at least runner-up; winner upgraded below
};

const API_BASE = "https://api.football-data.org/v4";
const COMPETITION = "WC";

// ─── CLIENTS ─────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const apiHeaders = { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY };

// Resolve an API team name to our canonical name
function canonical(name) {
  if (!name) return null;
  if (NAME_MAP[name]) return NAME_MAP[name];
  if (ALL_TEAMS.includes(name)) return name;
  return null; // unmatched
}

function monthDay(utcDate) {
  // "2026-06-12T19:00:00Z" → "Jun 12"
  const d = new Date(utcDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Australia/Sydney' });
}

function aestTime(utcDate) {
  // "2026-06-12T19:00:00Z" → "5:00 AM AEST"
  const d = new Date(utcDate);
  const t = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Sydney' });
  return `${t} AEST`;
}

// ─── FETCH ───────────────────────────────────────────────────────────────────

async function fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: apiHeaders });
  if (!res.ok) {
    throw new Error(`API ${path} returned ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// ─── BUILD TEAM DATA ─────────────────────────────────────────────────────────

async function buildTeamData() {
  console.log('📡 Fetching standings from football-data.org...');
  const standingsData = await fetchJson(`/competitions/${COMPETITION}/standings`);

  console.log('📡 Fetching matches from football-data.org...');
  const matchesData = await fetchJson(`/competitions/${COMPETITION}/matches`);

  // Initialise every team with defaults
  const result = {};
  for (const team of ALL_TEAMS) {
    result[team] = { pts: 0, gf: 0, ga: 0, gd: 0, round: 'Group Stage', eliminated: false, fixtures: [] };
  }

  const unmatched = new Set();

  // ── Standings: pts, gf, ga, gd from group tables ──
  // standings is an array; group-stage tables have type "TOTAL", one per group
  for (const standing of standingsData.standings || []) {
    if (standing.type !== 'TOTAL') continue;
    for (const row of standing.table || []) {
      const apiName = row.team?.name;
      const team = canonical(apiName);
      if (!team) { if (apiName) unmatched.add(apiName); continue; }
      result[team].pts = row.points ?? 0;
      result[team].gf  = row.goalsFor ?? 0;
      result[team].ga  = row.goalsAgainst ?? 0;
      result[team].gd  = (row.goalsFor ?? 0) - (row.goalsAgainst ?? 0);
    }
  }

  // ── Matches: fixtures, furthest round reached, elimination ──
  const matches = matchesData.matches || [];

  // Track the furthest stage each team appears in, and whether they won the final
  const furthestStage = {}; // team → round label index
  let championTeam = null;

  for (const m of matches) {
    const homeName = canonical(m.homeTeam?.name);
    const awayName = canonical(m.awayTeam?.name);
    if (m.homeTeam?.name && !homeName) unmatched.add(m.homeTeam.name);
    if (m.awayTeam?.name && !awayName) unmatched.add(m.awayTeam.name);

    const stageLabel = STAGE_MAP[m.stage] || 'Group Stage';
    const stageIdx = ROUNDS.indexOf(stageLabel);

    // Record fixtures for both teams
    for (const [team, oppName] of [[homeName, m.awayTeam?.name], [awayName, m.homeTeam?.name]]) {
      if (!team) continue;
      const opp = canonical(oppName) || oppName || 'TBD';
      const finished = m.status === 'FINISHED';
      let scoreStr = null;
      if (finished && m.score?.fullTime) {
        const isHome = team === homeName;
        const ft = m.score.fullTime;
        scoreStr = isHome ? `${ft.home}-${ft.away}` : `${ft.away}-${ft.home}`;
      }
      result[team].fixtures.push({
        date: monthDay(m.utcDate),
        time: aestTime(m.utcDate),
        opponent: opp,
        score: scoreStr,
        upcoming: !finished,
        _raw: m.utcDate,
      });

      // Track furthest stage reached (any appearance counts)
      if (stageIdx > (furthestStage[team] ?? 0)) furthestStage[team] = stageIdx;
    }

    // Determine champion: winner of the FINAL
    if (m.stage === 'FINAL' && m.status === 'FINISHED' && m.score?.winner) {
      const winnerName = m.score.winner === 'HOME_TEAM' ? homeName : m.score.winner === 'AWAY_TEAM' ? awayName : null;
      if (winnerName) championTeam = winnerName;
    }
  }

  // Apply furthest stage as the team's round
  for (const team of ALL_TEAMS) {
    const idx = furthestStage[team] ?? 0;
    result[team].round = ROUNDS[idx] || 'Group Stage';
  }
  // Upgrade champion
  if (championTeam) result[championTeam].round = 'Champion';

  // ── Elimination logic ──
  // A team is eliminated if all their fixtures are finished AND they didn't
  // progress to a later stage that has upcoming matches. Simplest reliable rule:
  // eliminated = they have no upcoming fixtures AND they are not the champion
  // AND the tournament isn't over for them at a winning position.
  for (const team of ALL_TEAMS) {
    const f = result[team].fixtures;
    const hasUpcoming = f.some(x => x.upcoming);
    const played = f.some(x => !x.upcoming);
    // If they've played at least one game, have nothing upcoming, and aren't champion/runner-up final → eliminated
    if (played && !hasUpcoming && result[team].round !== 'Champion' && result[team].round !== 'Runner-up') {
      result[team].eliminated = true;
    }
    // Sort each team's fixtures by date, then remove the temporary _raw field
    f.sort((a, b) => new Date(a._raw || 0) - new Date(b._raw || 0));
    f.forEach(x => { delete x._raw; });
  }

  if (unmatched.size) {
    console.log('\n⚠️  Unmatched team names from API (add these to NAME_MAP):');
    for (const n of unmatched) console.log(`   "${n}"`);
    console.log('');
  }

  return result;
}

// ─── WRITE TO SUPABASE ───────────────────────────────────────────────────────

async function writeToSupabase(data) {
  console.log('📝 Writing results to Supabase...');

  const rows = Object.entries(data).map(([team, stats]) => ({
    team,
    pts:        stats.pts,
    gf:         stats.gf,
    ga:         stats.ga,
    gd:         stats.gd,
    round:      stats.round,
    eliminated: stats.eliminated,
    fixtures:   stats.fixtures,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('team_stats')
    .upsert(rows, { onConflict: 'team' });

  if (error) throw error;
  console.log(`✅ Updated ${rows.length} teams in Supabase`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🏆 WC2026 Sweepstakes Update — ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST\n`);

  try {
    const data = await buildTeamData();

    const active = Object.values(data).filter(d => d.round !== 'Group Stage').length;
    const elim   = Object.values(data).filter(d => d.eliminated).length;
    console.log(`📊 Teams beyond group stage: ${active} · eliminated: ${elim}`);

    await writeToSupabase(data);
    console.log('\n✅ Update complete\n');
  } catch (err) {
    console.error('\n❌ Update failed:', err.message);
    process.exit(1);
  }
}

main();
