import Link from 'next/link';
import { select } from '@/lib/db';
import { loadMarketViews, scoreBand } from '@/lib/model';

export const dynamic = 'force-dynamic';

export default async function Opportunities() {
  const [marketViews, opportunities, scores] = await Promise.all([
    loadMarketViews(),
    select<any>('rros_opportunities', 'select=id,market_id,state,evidence_completeness,freshness_state,blocking_conditions&limit=200'),
    select<any>('rros_scores', 'select=entity_id,overall,subscores,confidence,lens_version,computed_at&entity_type=eq.opportunity&order=computed_at.desc&limit=500'),
  ]);
  const scoreByOpp = new Map<string, any>();
  for (const s of scores) if (!scoreByOpp.has(s.entity_id)) scoreByOpp.set(s.entity_id, s);

  const rows = opportunities
    .map((o) => ({ o, mv: marketViews.get(o.market_id), s: scoreByOpp.get(o.id) }))
    .filter((x) => x.mv && x.s)
    .sort((a, b) => Number(b.s.overall) - Number(a.s.overall));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Opportunities ({rows.length})</h1>
      <p className="text-sm text-slate-400">
        Deep-researched markets scored by Rank &amp; Rent Opportunity Lens v1. Click through for full evidence.
      </p>
      <div className="panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">#</th><th className="th">Niche</th><th className="th">Geography</th>
              <th className="th">Score</th><th className="th">Band</th><th className="th">Confidence</th>
              <th className="th">Missing evidence</th><th className="th">State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ o, mv, s }, i) => {
              const band = scoreBand(Number(s.overall));
              return (
                <tr key={o.id} className="hover:bg-edge/30">
                  <td className="td text-slate-500">{i + 1}</td>
                  <td className="td"><Link href={`/opportunities/${o.id}`} className="text-brand hover:underline">{mv!.nicheName}</Link></td>
                  <td className="td">{mv!.city}, {mv!.state}</td>
                  <td className="td font-semibold">{Number(s.overall).toFixed(1)}</td>
                  <td className={`td ${band.cls}`}>{band.label}</td>
                  <td className="td">{Number(s.confidence).toFixed(2)}</td>
                  <td className="td text-xs text-slate-400">{(o.blocking_conditions ?? []).join(', ') || '—'}</td>
                  <td className="td text-slate-400">{o.state}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
