import Dashboard from '../components/Dashboard';
import { ALL_TEAMS } from '../lib/data';

// Fetch fresh data on every request (SSR), falls back to empty stats
async function getTeamStats() {
  try {
    // In production this calls our own API route which reads from Supabase
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/team-stats`, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  } catch {
    // Fallback: all teams at Group Stage with no fixtures
    const stats = {};
    ALL_TEAMS.forEach(t => {
      stats[t] = { pts: 0, gf: 0, ga: 0, gd: 0, round: 'Group Stage', fixtures: [] };
    });
    return { stats, updatedAt: null };
  }
}

export default async function Page() {
  const { stats, updatedAt } = await getTeamStats();
  return <Dashboard teamStats={stats} updatedAt={updatedAt} />;
}
