import { select } from '@/lib/db';
import { loadMarketViews, fmtMoney, scoreBand } from '@/lib/model';

export const dynamic = 'force-dynamic';

const SUB_LABELS: Record<string, string> = {
  demand: 'Demand /20', competition: 'Competition /25', monetization: 'Monetization /15',
  domain: 'Domain /10', operatorBench: 'Operator bench /10', geoEconomics: 'Geo economics /10', buildability: 'Buildability /10',
};

export default async function OpportunityReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [opps, scores, marketViews] = await Promise.all([
    select<any>('rros_opportunities', `select=*&id=eq.${id}`),
    select<any>('rros_scores', `select=*&entity_id=eq.${id}&entity_type=eq.opportunity&order=computed_at.desc&limit=1`),
    loadMarketViews(),
  ]);
  const opp = opps[0];
  if (!opp) return <div className="text-slate-400">Opportunity not found.</div>;
  const score = scores[0];
  const mv = marketViews.get(opp.market_id);

  const [blueprints, snapshots, memberships] = await Promise.all([
    select<any>('rros_blueprint_versions', `select=*&opportunity_id=eq.${id}&order=version.desc&limit=1`),
    select<any>('rros_serp_snapshots', `select=id,query,provider,observed_at&market_id=eq.${opp.market_id}&order=observed_at.desc&limit=1`),
    select<any>('rros_pipeline_memberships', `select=business_id,role&market_id=eq.${opp.market_id}&limit=100`),
  ]);
  const bp = blueprints[0];
  const snap = snapshots[0];
  const serpResults = snap
    ? await select<any>('rros_serp_results', `select=position,result_type,url,domain,title,is_directory,is_franchise,is_emd,is_inner_page&snapshot_id=eq.${snap.id}&order=position.asc&limit=30`)
    : [];
  const bizIds = [...new Set(memberships.map((m) => m.business_id))];
  const businesses = bizIds.length
    ? await select<any>('rros_businesses', `select=id,canonical_name,root_domain&id=in.(${bizIds.join(',')})&limit=100`)
    : [];
  const bizById = new Map(businesses.map((b) => [b.id, b]));
  const operators = memberships.filter((m) => m.role === 'operator_candidate').map((m) => bizById.get(m.business_id)).filter(Boolean);
  const competitors = memberships.filter((m) => m.role === 'competitor').map((m) => bizById.get(m.business_id)).filter(Boolean);

  const band = score ? scoreBand(Number(score.overall)) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{mv?.nicheName} — {mv?.city}, {mv?.state}</h1>
        <p className="text-sm text-slate-400 mt-1">
          Freshness: {opp.freshness_state} · Evidence completeness: {Number(opp.evidence_completeness ?? 0).toFixed(2)} · Review: {opp.review_state}
        </p>
      </div>

      {score && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="panel p-5">
            <div className="text-4xl font-bold">{Number(score.overall).toFixed(1)}<span className="text-lg text-slate-500">/100</span></div>
            <div className={`mt-1 ${band!.cls}`}>{band!.label}</div>
            <div className="text-sm text-slate-400 mt-2">Confidence {Number(score.confidence).toFixed(2)} · {score.lens_version} · weights {score.weights_version}</div>
          </div>
          <div className="panel p-5 md:col-span-2">
            <h2 className="text-sm font-semibold text-slate-300 mb-2">Subscores</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {Object.entries(score.subscores ?? {}).map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-slate-400">{SUB_LABELS[k] ?? k}</span><span className="font-medium">{String(v)}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(opp.blocking_conditions ?? []).length > 0 && (
        <div className="panel p-4 border-warn/40">
          <h2 className="text-sm font-semibold text-warn mb-1">Missing / blocking evidence</h2>
          <p className="text-sm text-slate-300">{(opp.blocking_conditions ?? []).join(' · ')}</p>
        </div>
      )}

      {score && (
        <div className="panel p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Reasons</h2>
          <ul className="text-sm text-slate-300 space-y-1">
            {(score.reasons ?? []).map((r: string, i: number) => <li key={i} className="text-slate-400">• {r}</li>)}
          </ul>
        </div>
      )}

      {snap && (
        <div className="panel p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-2">
            SERP evidence — “{snap.query}” · provider {snap.provider} · observed {new Date(snap.observed_at).toLocaleDateString()}
          </h2>
          <table className="w-full">
            <thead><tr><th className="th">#</th><th className="th">Result</th><th className="th">Domain</th><th className="th">Signals</th></tr></thead>
            <tbody>
              {serpResults.filter((r) => r.result_type === 'organic').map((r) => (
                <tr key={`${r.position}-${r.domain}`}>
                  <td className="td text-slate-500">{r.position}</td>
                  <td className="td max-w-md truncate">{r.url ? <a href={r.url} className="hover:underline" target="_blank">{r.title ?? r.url}</a> : r.title}</td>
                  <td className="td text-slate-400">{r.domain}</td>
                  <td className="td text-xs text-slate-400">
                    {[r.is_directory && 'directory', r.is_franchise && 'franchise', r.is_emd && 'EMD', r.is_inner_page && 'inner page'].filter(Boolean).join(' · ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="panel p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Operator candidates ({operators.length})</h2>
          <ul className="text-sm space-y-1">
            {operators.map((b: any) => <li key={b.id}>{b.canonical_name} <span className="text-slate-500">{b.root_domain ?? ''}</span></li>)}
            {operators.length === 0 && <li className="text-slate-500">None identified yet</li>}
          </ul>
        </div>
        <div className="panel p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Competitors tracked ({competitors.length})</h2>
          <ul className="text-sm space-y-1">
            {competitors.slice(0, 10).map((b: any) => <li key={b.id}>{b.canonical_name} <span className="text-slate-500">{b.root_domain ?? ''}</span></li>)}
          </ul>
        </div>
      </div>

      {bp && (
        <div className="panel p-5 space-y-4">
          <h2 className="text-sm font-semibold text-brand">Blueprint Lite v{bp.version} <span className="text-slate-500">({bp.status})</span></h2>
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div><span className="text-slate-400">Recommended domain:</span> <span className="font-medium">{bp.recommended_domain ?? '—'}</span></div>
            <div><span className="text-slate-400">Alternatives:</span> {(bp.alt_domains ?? []).join(', ') || '—'}</div>
            <div><span className="text-slate-400">Availability verified:</span> {bp.domain_availability_checked_at ? new Date(bp.domain_availability_checked_at).toLocaleString() : 'NOT VERIFIED'}</div>
            <div><span className="text-slate-400">Est. build cost:</span> {fmtMoney(bp.est_cost_low)}–{fmtMoney(bp.est_cost_high)}</div>
            <div><span className="text-slate-400">Est. time to rank:</span> {bp.est_rank_months_low}–{bp.est_rank_months_high} months</div>
            <div><span className="text-slate-400">Est. leads:</span> {bp.est_leads_low}–{bp.est_leads_high}/mo</div>
            <div><span className="text-slate-400">Est. revenue:</span> {fmtMoney(bp.est_revenue_low)}–{fmtMoney(bp.est_revenue_high)}/mo</div>
            <div><span className="text-slate-400">Operator strategy:</span> {bp.operator_strategy?.summary ?? '—'}</div>
          </div>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h3 className="text-slate-400 mb-1">Services</h3>
              <ul className="space-y-0.5">{(bp.target_services ?? []).map((s: string) => <li key={s}>• {s}</li>)}</ul>
            </div>
            <div>
              <h3 className="text-slate-400 mb-1">Sitemap</h3>
              <ul className="space-y-0.5">{(bp.sitemap ?? []).map((s: string) => <li key={s} className="font-mono text-xs">{s}</li>)}</ul>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h3 className="text-slate-400 mb-1">Risks</h3>
              <ul className="space-y-0.5">{(bp.risks ?? []).map((s: string, i: number) => <li key={i} className="text-warn">• {s}</li>)}</ul>
            </div>
            <div>
              <h3 className="text-slate-400 mb-1">Assumptions</h3>
              <ul className="space-y-0.5">{(bp.assumptions ?? []).map((s: string, i: number) => <li key={i} className="text-slate-400">• {s}</li>)}</ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
