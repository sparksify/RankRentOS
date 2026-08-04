import { select } from '@/lib/db';
import { loadMarketViews } from '@/lib/model';
import BatchBoard, { type TargetView } from './board';

export const dynamic = 'force-dynamic';

export default async function Batch1() {
  const [marketViews, targets, opportunities, scores, blueprints] = await Promise.all([
    loadMarketViews(),
    select<any>('rros_batch_targets', 'select=*&batch=eq.batch-1&order=position.asc&limit=50'),
    select<any>('rros_opportunities', 'select=id,market_id,freshness_state,blocking_conditions&limit=200'),
    select<any>('rros_scores', 'select=entity_id,overall,subscores,confidence,reasons,computed_at&entity_type=eq.opportunity&order=computed_at.desc&limit=500'),
    select<any>('rros_blueprint_versions', 'select=opportunity_id,recommended_domain,alt_domains,domain_availability_checked_at,est_cost_low,est_cost_high,est_rank_months_low,est_rank_months_high,est_leads_low,est_leads_high,est_revenue_low,est_revenue_high,risks,status&limit=100'),
  ]);

  const oppById = new Map(opportunities.map((o) => [o.id, o]));
  const scoreByOpp = new Map<string, any>();
  for (const s of scores) if (!scoreByOpp.has(s.entity_id)) scoreByOpp.set(s.entity_id, s);
  const bpByOpp = new Map(blueprints.map((b) => [b.opportunity_id, b]));

  const views: TargetView[] = targets
    .map((t) => {
      const opp = oppById.get(t.opportunity_id);
      const mv = opp ? marketViews.get(opp.market_id) : undefined;
      const s = scoreByOpp.get(t.opportunity_id);
      const bp = bpByOpp.get(t.opportunity_id);
      if (!opp || !mv || !s) return null;
      return {
        id: t.id,
        opportunityId: t.opportunity_id,
        role: t.role,
        position: t.position,
        decision: t.decision,
        notes: t.notes ?? '',
        locked: t.locked,
        inclusionReasons: t.inclusion_reasons ?? [],
        niche: mv.nicheName,
        nicheSlug: mv.nicheSlug,
        geography: `${mv.city}, ${mv.state}`,
        region: mv.region ?? mv.state,
        overall: Number(s.overall),
        confidence: Number(s.confidence),
        subscores: s.subscores ?? {},
        reasons: (s.reasons ?? []).slice(0, 6),
        freshness: opp.freshness_state,
        missing: opp.blocking_conditions ?? [],
        domain: bp?.recommended_domain ?? null,
        altDomains: bp?.alt_domains ?? [],
        domainCheckedAt: bp?.domain_availability_checked_at ?? null,
        estCost: bp ? [bp.est_cost_low, bp.est_cost_high] : null,
        estRankMonths: bp ? [bp.est_rank_months_low, bp.est_rank_months_high] : null,
        estLeads: bp ? [bp.est_leads_low, bp.est_leads_high] : null,
        estRevenue: bp ? [bp.est_revenue_low, bp.est_revenue_high] : null,
        risks: bp?.risks ?? [],
        blueprintStatus: bp?.status ?? 'missing',
      } as TargetView;
    })
    .filter((v): v is TargetView => v !== null);

  return <BatchBoard targets={views} />;
}
