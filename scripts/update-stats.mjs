#!/usr/bin/env node
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
globalThis.WebSocket = WebSocket;
/**
 * WC2026 Sweepstakes — Daily Update Script
 * =========================================
 * Runs via GitHub Actions every day at 5pm AEST (07:00 UTC).
 * Uses Claude to scrape live World Cup results, then writes them to Supabase.
 *
 * Required environment variables:
 *   ANTHROPIC_API_KEY      — your Anthropic API key
 *   NEXT_PUBLIC_SUPABASE_URL        — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY       — Supabase service role key (not anon key — needs write access)
 */

import Anthropic from '@anthropic-ai/sdk';
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

// ─── CLIENTS ─────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // service role key for write access
);

// ─── STEP 1: Ask Claude to fetch and parse live WC results ───────────────────

async function fetchLiveResults() {
  console.log('🤖 Asking Claude to fetch live World Cup 2026 results...');

  const prompt = `You are a sports data assistant. Search the web for the latest FIFA World Cup 2026 results and standings right now.

For each of these teams, return their current tournament data:
${ALL_TEAMS.join(', ')}

Return ONLY a valid JSON object with this exact structure — no preamble, no markdown, no explanation:
{
  "TeamName": {
    "pts": 0,
    "gf": 0,
    "ga": 0,
    "gd": 0,
    "round": "Group Stage",
    "eliminated": false,
    "fixtures": [
      { "date": "Jun 12", "time": "5:00 AM AEST", "opponent": "OpponentName", "score": "2-1", "upcoming": false },
      { "date": "Jun 17", "time": "8:00 AM AEST", "opponent": "OpponentName", "score": null, "upcoming": true }
    ]
  }
}

Rules:
- "round" must be one of: ${ROUNDS.join(', ')}
- "pts" = total tournament points (group stage: W=3,D=1,L=0; knockout teams keep group pts)
- "gf" = goals for total, "ga" = goals against total, "gd" = gf minus ga
- "score" = "X-Y" string for played matches (team's goals first), null for upcoming
- "upcoming" = true if the match hasn't been played yet
- Include all group stage matches plus any knockout matches played
- "eliminated" = true only if the team has been mathematically knocked out of the tournament (lost in knockout stage, or cannot qualify from group stage). Otherwise false, even if they've lost a group match.
- "round" = the last round they reached or are currently competing in
- "time" = the kickoff time converted to AEST (UTC+10), formatted like "5:00 AM AEST" or "11:00 AM AEST"
- If the tournament hasn't started yet, return all teams with pts:0, gf:0, ga:0, gd:0, round:"Group Stage"
- Return data for ALL ${ALL_TEAMS.length} teams listed above`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 16000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: prompt }],
  });

 // Extract the LAST text block — Claude may produce several while searching,
// the final one should contain the JSON
const textBlocks = response.content.filter(b => b.type === 'text');
if (!textBlocks.length) throw new Error('No text response from Claude');
const textBlock = textBlocks[textBlocks.length - 1];

// Strip any accidental markdown fences
const cleaned = textBlock.text.replace(/```json|```/g, '').trim();

let parsed;
try {
  // Find the first '{' and walk forward tracking brace depth to find its match
  const start = cleaned.indexOf('{');
  if (start === -1) throw new Error('No JSON object found');
  let depth = 0, end = -1;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++;
    else if (cleaned[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) throw new Error('No matching closing brace found');
  parsed = JSON.parse(cleaned.slice(start, end + 1));
} catch (e) {
  console.error('Failed to parse Claude response:', cleaned.slice(0, 1000));
  parsed = {};
}

  return parsed;
}

// ─── STEP 2: Validate and normalise the data ─────────────────────────────────

function normalise(rawData) {
  const result = {};

  for (const team of ALL_TEAMS) {
    const raw = rawData[team];

    if (!raw) {
      console.warn(`⚠️  Missing data for ${team}, using defaults`);
      result[team] = { pts: 0, gf: 0, ga: 0, gd: 0, round: 'Group Stage', eliminated: false, fixtures: [] };
      continue;
    }

    const round = ROUNDS.includes(raw.round) ? raw.round : 'Group Stage';
    const pts   = typeof raw.pts === 'number' ? raw.pts : 0;
    const gf    = typeof raw.gf  === 'number' ? raw.gf  : 0;
    const ga    = typeof raw.ga  === 'number' ? raw.ga  : 0;
    const gd    = gf - ga;

  const fixtures = Array.isArray(raw.fixtures)
  ? raw.fixtures.map(f => ({
      date:     f.date     || '',
      time:     f.time     || '',
      opponent: f.opponent || '',
      score:    f.score    || null,
      upcoming: !!f.upcoming,
    }))
  : [];

const eliminated = !!raw.eliminated;

result[team] = { pts, gf, ga, gd, round, eliminated, fixtures };

  return result;
}

// ─── STEP 3: Write to Supabase ────────────────────────────────────────────────

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
    const raw  = await fetchLiveResults();
    const data = normalise(raw);

    // Log summary
    const active = Object.values(data).filter(d => d.round !== 'Group Stage').length;
    console.log(`📊 Teams beyond group stage: ${active}`);

    await writeToSupabase(data);

    console.log('\n✅ Update complete\n');
  } catch (err) {
    console.error('\n❌ Update failed:', err.message);
    process.exit(1);
  }
}

main();
