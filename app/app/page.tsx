import Link from 'next/link';
import { count, select } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const [
    markets, qualified, rejected, deepResearched, candidatesPassed, opportunities,
    batchPrimary, batchDecided, jobs, kwObs,
  ] = await Promise.all([
    count('rros_markets'),
    count('rros_markets', 'research_state=eq.qualified'),
    count('rros_markets', 'research_state=eq.rejected'),
    count('rros_markets', 'research_state=eq.deep_researched'),
    count('rros_candidates', 'result=eq.passed'),
    count('rros_opportunities'),
    count('rros_batch_targets', 'role=eq.primary'),
    count('rros_batch_targets', 'decision=neq.pending'),
    select<any>('rros_jobs', 'select=id,type,status,progress,actual_cost_usd,completed_at&order=requested_at.desc&limit=5'),
    select<any>('rros_keyword_observations', 'select=observed_at&order=observed_at.desc&limit=1'),
  ]);

  const running = jobs.filter((j) => j.status === 'running').length;
  const totalCost = jobs.reduce((s, j) => s + Number(j.actual_cost_usd ?? 0), 0);
  const kwAgeDays = kwObs[0] ? Math.round((Date.now() - new Date(kwObs[0].observed_at).getTime()) / 86_400_000) : null;
  const kwStale = kwAgeDays !== null && kwAgeDays > 90;

  const stats: [string, string | number, string?][] = [
    ['Markets known', markets],
    ['Qualified', qualified],
    ['Rejected', rejected],
    ['Deep researched', deepResearched],
    ['Candidates passed', candidatesPassed],
    ['Opportunities', opportunities],
    ['Batch 1 primaries', batchPrimary],
    ['Decisions made', batchDecided],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Discovery Dashboard</h1>
        <span className="text-sm text-slate-400">Research jobs running: {running} · Provider cost this cycle: ${totalCost.toFixed(2)}</span>
      </div>

      {kwStale ? (
        <div className="panel p-4 border-warn/50 text-warn text-sm">
          Keyword observations are {kwAgeDays} days old (&gt;90-day policy) — re-verify volumes before acting on demand numbers.
        </div>
      ) : (
        <div className="panel p-4 text-sm text-slate-400">
          Keyword volumes observed {kwAgeDays ?? '—'} day(s) ago (fresh within the 90-day policy). SERP evidence this cycle is
          web-search proxy grade — confidence scores reflect that; verify with a localized SERP provider before build.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(([label, value]) => (
          <div key={label} className="panel p-4">
            <div className="text-2xl font-semibold">{value}</div>
            <div className="text-xs text-slate-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Link href="/discovery" className="btn bg-brand/10 border-brand/40 text-brand">Run Discovery</Link>
        <Link href="/candidates" className="btn">Review Candidates</Link>
        <Link href="/opportunities" className="btn">Top Opportunities</Link>
        <Link href="/batch1" className="btn">Open Batch 1</Link>
      </div>

      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Recent jobs</h2>
        <table className="w-full">
          <thead><tr><th className="th">Type</th><th className="th">Status</th><th className="th">Progress</th><th className="th">Cost</th></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td className="td">{j.type}</td>
                <td className="td">{j.status}</td>
                <td className="td text-slate-400">{JSON.stringify(j.progress)}</td>
                <td className="td">${Number(j.actual_cost_usd ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
