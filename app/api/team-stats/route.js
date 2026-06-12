import { supabase } from '../../../lib/supabase';
import { ALL_TEAMS } from '../../../lib/data';

export const revalidate = 0;

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('team_stats')
      .select('*');

    if (error) throw error;

    // Convert array of rows into a keyed object { teamName: { pts, gf, ga, gd, round, eliminated, fixtures } }
    const statsMap = {};
    (data || []).forEach(row => {
      statsMap[row.team] = {
        pts: row.pts ?? 0,
        gf: row.gf ?? 0,
        ga: row.ga ?? 0,
        gd: row.gd ?? 0,
        round: row.round ?? 'Group Stage',
        eliminated: row.eliminated ?? false,
        fixtures: row.fixtures ?? [],
      };
    });

    // Fill in any missing teams with defaults
    ALL_TEAMS.forEach(team => {
      if (!statsMap[team]) {
        statsMap[team] = { pts: 0, gf: 0, ga: 0, gd: 0, round: 'Group Stage', eliminated: false, fixtures: [] };
      }
    });

    return Response.json({
      stats: statsMap,
      updatedAt: data?.[0]?.updated_at ?? null,
    });

  } catch (err) {
    console.error('Error fetching team stats:', err);
    return Response.json({ stats: {}, updatedAt: null }, { status: 500 });
  }
}
