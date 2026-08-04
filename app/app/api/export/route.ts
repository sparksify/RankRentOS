import { select } from '@/lib/db';
import { loadMarketViews } from '@/lib/model';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get('format') ?? 'csv';
  const [marketViews, targets, opportunities, scores, blueprints] = await Promise.all([
    loadMarketViews(),
    select<any>('rros_batch_targets', 'select=*&batch=eq.batch-1&order=role.desc,position.asc&limit=50'),
    select<any>('rros_opportunities', 'select=id,market_id,blocking_conditions,freshness_state&limit=200'),
    select<any>('rros_scores', 'select=entity_id,overall,subscores,confidence&entity_type=eq.opportunity&order=computed_at.desc&limit=500'),
    select<any>('rros_blueprint_versions', 'select=opportunity_id,recommended_domain,alt_domains,est_revenue_low,est_revenue_high,est_cost_low,est_cost_high,est_rank_months_low,est_rank_months_high&limit=100'),
  ]);
  const oppById = new Map(opportunities.map((o) => [o.id, o]));
  const scoreByOpp = new Map<string, any>();
  for (const s of scores) if (!scoreByOpp.has(s.entity_id)) scoreByOpp.set(s.entity_id, s);
  const bpByOpp = new Map(blueprints.map((b) => [b.opportunity_id, b]));

  const rows = targets.map((t) => {
    const opp = oppById.get(t.opportunity_id);
    const mv = opp ? marketViews.get(opp.market_id) : undefined;
    const s = scoreByOpp.get(t.opportunity_id) ?? {};
    const bp = bpByOpp.get(t.opportunity_id) ?? {};
    return {
      role: t.role,
      position: t.position > 100 ? t.position - 100 : t.position,
      niche: mv?.nicheName ?? '',
      geography: mv ? `${mv.city}, ${mv.state}` : '',
      score: s.overall ?? '',
      confidence: s.confidence ?? '',
      domain: bp.recommended_domain ?? '',
      alt_domains: (bp.alt_domains ?? []).join(' | '),
      est_revenue: bp.est_revenue_low ? `${bp.est_revenue_low}-${bp.est_revenue_high}` : '',
      est_cost: bp.est_cost_low ? `${bp.est_cost_low}-${bp.est_cost_high}` : '',
      est_rank_months: bp.est_rank_months_low ? `${bp.est_rank_months_low}-${bp.est_rank_months_high}` : '',
      decision: t.decision,
      locked: t.locked,
      missing_evidence: (opp?.blocking_conditions ?? []).join(' | '),
      notes: t.notes ?? '',
    };
  });

  if (format === 'md') {
    const cols = Object.keys(rows[0] ?? { role: '' });
    const md = [
      '# Batch 1 — First 10 Assets',
      '',
      `Exported ${new Date().toISOString()}`,
      '',
      `| ${cols.join(' | ')} |`,
      `| ${cols.map(() => '---').join(' | ')} |`,
      ...rows.map((r) => `| ${cols.map((c) => String((r as any)[c]).replace(/\|/g, '/')).join(' | ')} |`),
    ].join('\n');
    return new Response(md, { headers: { 'content-type': 'text/markdown', 'content-disposition': 'attachment; filename="batch-1.md"' } });
  }

  const cols = Object.keys(rows[0] ?? { role: '' });
  const csv = [
    cols.join(','),
    ...rows.map((r) => cols.map((c) => `"${String((r as any)[c]).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  return new Response(csv, { headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="batch-1.csv"' } });
}
