import { select } from '@/lib/db';
import { loadMarketViews } from '@/lib/model';
import CandidatesTable, { type CandidateRow } from './table';

export const dynamic = 'force-dynamic';

export default async function Candidates() {
  const [marketViews, candidates] = await Promise.all([
    loadMarketViews(),
    select<any>('rros_candidates', 'select=id,market_id,result,reasons,confidence,qualified_at&order=qualified_at.desc&limit=2000'),
  ]);

  // Latest candidate row per market
  const latest = new Map<string, any>();
  for (const c of candidates) if (!latest.has(c.market_id)) latest.set(c.market_id, c);

  const rows: CandidateRow[] = [];
  for (const [marketId, c] of latest) {
    const mv = marketViews.get(marketId);
    if (!mv) continue;
    const reasons: { gate: string; outcome: string; detail: string }[] = c.reasons ?? [];
    const prelim = Number(reasons.find((r) => r.gate === 'preliminary_score')?.detail ?? 0);
    const primary =
      reasons.find((r) => r.outcome === 'fail')?.detail ??
      reasons.find((r) => r.gate === 'demand')?.detail ??
      '';
    rows.push({
      id: c.id,
      niche: mv.nicheName,
      geography: `${mv.city}, ${mv.state}`,
      region: mv.region ?? mv.state,
      result: c.result,
      prelim,
      confidence: Number(c.confidence),
      freshness: mv.researchState === 'deep_researched' ? 'fresh' : 'corpus',
      reason: primary,
      reasons: reasons.filter((r) => r.gate !== 'preliminary_score').map((r) => `[${r.outcome}] ${r.gate}: ${r.detail}`),
    });
  }
  rows.sort((a, b) => b.prelim - a.prelim);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Candidate Explorer</h1>
      <p className="text-sm text-slate-400">
        Every market gets a qualification verdict with reasons — rejected markets are shown, not hidden. Research cost
        for qualification: $0 (uses owned observations).
      </p>
      <CandidatesTable rows={rows} />
    </div>
  );
}
