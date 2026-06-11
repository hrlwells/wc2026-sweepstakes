#!/usr/bin/env node import { WebSocket } from 'ws';
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
    "fixtures": [
      { "date": "Jun 12", "opponent": "OpponentName", "score": "2-1", "upcoming": false },
      { "date": "Jun 17", "opponent": "OpponentName", "score": null, "upcoming": true }
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
- If a team is eliminated, their "round" = the last round they reached
- If the tournament hasn't started yet, return all teams with pts:0, gf:0, ga:0, gd:0, round:"Group Stage"
- Return data for ALL ${ALL_TEAMS.length} teams listed above`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract the final text response (after tool use)
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('No text response from Claude');

  // Strip any accidental markdown fences
  const cleaned = textBlock.text.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse Claude response:', cleaned.slice(0, 500));
    throw new Error('Claude did not return valid JSON');
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
      result[team] = { pts: 0, gf: 0, ga: 0, gd: 0, round: 'Group Stage', fixtures: [] };
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
          opponent: f.opponent || '',
          score:    f.score    || null,
          upcoming: !!f.upcoming,
        }))
      : [];

    result[team] = { pts, gf, ga, gd, round, fixtures };
  }

  return result;
}

// ─── STEP 3: Write to Supabase ────────────────────────────────────────────────

async function writeToSupabase(data) {
  console.log('📝 Writing results to Supabase...');

  const rows = Object.entries(data).map(([team, stats]) => ({
    team,
    pts:      stats.pts,
    gf:       stats.gf,
    ga:       stats.ga,
    gd:       stats.gd,
    round:    stats.round,
    fixtures: stats.fixtures,
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
