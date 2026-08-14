import Link from "next/link";
import Nav from "../../Nav";
import Badge from "../../Badge";
import Tabs from "../../Tabs";
import { loadRun, loadDecisions, findAsset, idOf, money, num } from "../../../../lib/cockpit";

export const dynamic = "force-static";
export function generateStaticParams() { return loadRun().assets.map((a) => ({ id: idOf(a) })); }

const DIMS = [
  ["A", "Rankability", "How beatable the search results are (includes map-pack weakness)"],
  ["B", "Demand", "Measured search volume for the exact term"],
  ["C", "Commercial Intent", "Whether advertisers are paying to acquire this customer"],
  ["D", "Lead Economics", "Gross profit the renter earns per lead"],
  ["E", "Renter Depth", "How many local operators could actually rent this"],
  ["F", "Asset Value", "Realizable monthly gross profit from the lead flow"],
  ["G", "Time-to-Signal", "How fast we expect first ranking movement"],
  ["H", "Asymmetry", "Whether the upside is unusually mispriced"],
  ["I", "Confidence", "Evidence quality — independent of opportunity quality"],
];
const REC = (s) => s === "PASS" ? ["BUY CANDIDATE", "b-pass"] : s === "PASS_WITH_WARNING" ? ["BUY — WITH WARNINGS", "b-warn"]
  : s === "NEEDS_REVIEW" ? ["NEEDS REVIEW", "b-review"] : ["DO NOT BUY", "b-fail"];

function Tree({ node, lvl = 0 }) {
  return (
    <>
      <div className={`lvl${Math.min(lvl, 3)}`}>{lvl > 0 ? "└─ " : ""}<b>{node.path}</b> <span className="dim">{node.label}</span></div>
      {(node.children || []).map((c) => <Tree key={c.path} node={c} lvl={lvl + 1} />)}
    </>
  );
}

export default async function Detail({ params }) {
  const { id } = await params;
  const a = findAsset(id);
  if (!a) return <div className="shell"><Nav /><p>Not found.</p></div>;
  const run = loadRun();
  const dec = loadDecisions().assets.find((d) => d.experimentId === a.experimentId) || null;
  const cmp = run.comparison.find((c) => c.key === a.key);
  const v = a.validation;
  const [recText, recCls] = REC(v.gate.status);
  const cb = run.economics.costBasis;
  const isHub = dec?.isHubPage;
  const domain = isHub ? dec?.hubDomain : (a.preferredDomain || dec?.preferredDomain);
  const upfront = (isHub ? 0 : cb.known.domainFirstYear) + cb.estimated.content + cb.estimated.deploy;
  const monthly = (isHub ? 0 : cb.estimated.hosting) + cb.estimated.monitoring;
  const modelledGp = dec?.new?.expectedLeadsPerMonth && dec?.new?.leadValueUsd
    ? Math.round(dec.new.expectedLeadsPerMonth * dec.new.leadValueUsd) : null;

  // the quick "why we think we can rank" — the 2-3 strongest organic facts
  const whyRank = [];
  const os = a.organicStructure;
  if (os) {
    whyRank.push(`${os.displaceableTop5} of ${os.distinctHostsTop5} distinct top-5 hosts are displaceable (directories, adjacent sites, national content) — organic-v1.2 scores this SERP ${a.organicV1} (${a.organicVerdict}).`);
    if (os.hardLocalTop3 === 0) whyRank.push("No real local competitor holds the top 3 — the strongest structural opening we measure.");
    else whyRank.push(`${os.hardLocalTop3} genuine local competitor${os.hardLocalTop3 === 1 ? "" : "s"} in the top 3; ${os.geoTargetedCompetitorsTop5 ?? 0} explicitly target this geography.`);
    if (typeof a.contentBarWords === "number") whyRank.push(`Competitor content bar is ~${num(a.contentBarWords)} words${a.competitorDomainAgeYears ? ` on domains averaging ${a.competitorDomainAgeYears}y` : ""} — ${a.contentBarWords < 900 ? "cheap to out-publish" : "beatable with a serious page"}.`);
  }

  return (
    <div className="shell">
      <Nav on="/cockpit/portfolio" />
      <p style={{ marginBottom: 12 }}><Link href="/cockpit/portfolio">← Back to portfolio</Link></p>

      <div className="memo-head">
        <div className="domain-hero">
          <span className="dn">{domain || "domain t.b.d."}</span>
          <span className={`badge ${a.domainVerifiedAtFreeze === true || isHub ? "b-pass" : "b-warn"}`}>
            {isHub ? "page on shared hub" : a.domainVerifiedAtFreeze === true ? "verified available" : "re-check availability"}</span>
          <span className={`badge ${recCls}`}>{recText}</span>
          {dec && <span className={`badge ${dec.new.decision === "REVENUE_CANDIDATE" ? "b-pass" : "b-neutral"}`}>{dec.new.decision === "REVENUE_CANDIDATE" ? "Revenue candidate" : "Experiment"}</span>}
        </div>
        <h2 style={{ fontSize: 18, margin: 0 }}>{a.service} — {a.geography}, {a.state}</h2>
        <div className="sub">{a.experimentId} · {a.cohort}{cmp ? ` · rank #${cmp.newRank} (was #${cmp.oldRank})` : ""}{isHub ? ` · ${dec.hubDomain}/${a.geography.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/` : ""}</div>

        <div className="quickfacts">
          <div><label>Upfront cost</label><b>${upfront.toFixed(2)}</b></div>
          <div><label>Monthly</label><b>${monthly.toFixed(2)}</b></div>
          <div><label>Domain / yr</label><b>{isHub ? "shared" : `$${cb.known.domainFirstYear}`}</b></div>
          <div><label>Est. lead value</label><b>{a.leadValueAssumedUsd ? `$${num(a.leadValueAssumedUsd)}` : "—"}</b></div>
          <div><label>Modelled GP / mo</label><b>{modelledGp ? `~$${num(modelledGp)}` : "unproven"}</b></div>
          <div><label>Demand</label><b>{a.measuredVolume === 0 ? "0*" : num(a.measuredVolume)}</b></div>
          <div><label>Viable renters</label><b>{v.renterEvidence?.viableRenters ?? a.renterContext?.viableRenters ?? "—"}</b></div>
        </div>

        <div className="whyrank">
          {whyRank.map((w, i) => <div className="w" key={i}>{w}</div>)}
          {a.hypothesis && <div className="w" style={{ color: "var(--ink-2)" }}><i>Hypothesis: {a.hypothesis}</i></div>}
        </div>
      </div>

      {(v.gate.blockers.length > 0 || v.gate.warnings.length > 0) && (
        <div className="sec">
          {v.gate.blockers.map((b, i) => <div className="risk blocker" key={i}><b>Blocker.</b> {b}</div>)}
          {v.gate.warnings.map((w, i) => <div className="risk" key={i}><b>Warning.</b> {w}</div>)}
        </div>
      )}

      <div className="sec">
        <Tabs labels={["Scorecard", "SERP & Intent", "Expansion & Site Plan", "Economics", "Evidence"]}>
          <div>{/* -------- Scorecard -------- */}
            {a.dimensions ? DIMS.map(([letter, name, blurb]) => {
              const d = a.dimensions[letter];
              const val = d?.score;
              return (
                <div className="score-row" key={letter}>
                  <div className="lt">{letter}</div>
                  <div className="vl">{val ?? <span className="dim" style={{ fontSize: 13 }}>—</span>}</div>
                  <div className="ex">
                    <b>{name}</b> <span className="dim" style={{ fontWeight: 400 }}>— {blurb}</span>
                    {typeof val === "number" && <div className="bar"><i style={{ width: `${val}%` }} /></div>}
                    <div className="meta">{(d?.rationale || []).slice(0, 2).join(" · ") || "No rationale recorded."}
                      {d?.confidence != null && ` · confidence ${Number(d.confidence).toFixed(2)}`}{d?.version && ` · ${d.version}`}</div>
                  </div>
                </div>);
            }) : <p className="note">{a.dimensionsNote}</p>}
            <div className="score-row">
              <div className="lt" style={{ color: "var(--ink)" }}>O</div>
              <div className="vl">{a.organicV1 ?? "—"}</div>
              <div className="ex"><b>Organic-only rankability ({a.organicVersion || "organic-v1.2"})</b>
                {a.organicV1 != null && <div className="bar"><i style={{ width: `${a.organicV1}%` }} /></div>}
                <div className="meta">{a.organicVerdict} · organic positions 1–10 only; map-pack credit excluded (no GBP).
                  {a.modelDisagreement ? ` A and O disagree by ${a.modelDisagreement} points — part of the model-validation test.` : ""}</div></div>
            </div>
          </div>

          <div>{/* -------- SERP & Intent -------- */}
            <h3 style={{ marginTop: 0 }}>What Google actually shows</h3>
            <div className="slots">{(a.organicTop5 || v.intent.evidence.topSlots).map((s, i) => {
              const m = String(s).match(/^(\d+)\.\s(\S+)\s\[(.+)\]$/);
              return <div key={i}>{m ? <>{m[1]}. <b>{m[2]}</b> <span className="tag">[{m[3]}]</span></> : s}</div>;
            })}</div>
            <div className="kv" style={{ margin: "14px 0" }}>
              <div><label>Distinct hosts</label><b>{os?.distinctHostsTop5 ?? "—"}</b></div>
              <div><label>Displaceable</label><b>{os?.displaceableTop5 ?? "—"}</b></div>
              <div><label>Hard local top-3</label><b>{os?.hardLocalTop3 ?? "—"}</b></div>
              <div><label>Content bar</label><b>{a.contentBarWords ? `${num(a.contentBarWords)}w` : "—"}</b></div>
              <div><label>Competitor age</label><b>{a.competitorDomainAgeYears ? `${a.competitorDomainAgeYears}y` : "—"}</b></div>
            </div>
            <h3>Commercial intent — {v.intent.intentClass.replace(/_/g, " ").toLowerCase()} <Badge status={v.intent.verdict} /></h3>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: "80ch" }}>{v.intent.explanation}</p>
            <p className="note" style={{ marginTop: 8 }}>Local pack: {a.localPackEvidence?.mapPackSize ?? "—"} listings{a.localPackEvidence?.avgReviews ? `, ${a.localPackEvidence.avgReviews} avg reviews` : ""}. Market evidence only — excluded from organic scoring.</p>
          </div>

          <div>{/* -------- Expansion & Site Plan -------- */}
            <h3 style={{ marginTop: 0 }}>Expansion surface <Badge status={v.expansion.verdict} /></h3>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: "80ch" }}>{v.expansion.explanation}</p>
            <div className="kv" style={{ margin: "12px 0" }}>
              <div><label>Services</label><b>{v.expansion.evidence.viableServiceCount}</b></div>
              <div><label>Areas</label><b>{v.expansion.evidence.viableAreaCount}</b></div>
              <div><label>Service × Area pages</label><b>{v.expansion.evidence.viableCombinations}</b></div>
              <div><label>Demand covered</label><b>{num(v.expansion.evidence.demandCoveredPerMonth)}/mo</b></div>
            </div>
            <h3>Proposed site map — {v.architecture.estimatedPages} pages</h3>
            <div className="tree"><Tree node={v.architecture.tree} /></div>
            <h3 style={{ marginTop: 16 }}>Cannibalization <Badge status={v.cannibalization.verdict} /></h3>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: "80ch" }}>{v.cannibalization.explanation}</p>
            {v.cannibalization.evidence.recommendations.slice(0, 2).map((r, i) => <div className="risk" key={i}>{r}</div>)}
          </div>

          <div>{/* -------- Economics -------- */}
            <div className="kv" style={{ marginBottom: 14 }}>
              <div><label>Assumed ticket</label><b>{money(a.ticketAssumed)}</b></div>
              <div><label>Assumed margin</label><b>{a.marginAssumed ?? "—"}</b></div>
              <div><label>Lead value</label><b>{money(a.leadValueAssumedUsd)}</b></div>
              <div><label>Modelled GP / mo</label><b>{modelledGp ? `~$${num(modelledGp)}` : "unproven"}</b></div>
              <div><label>Viable renters</label><b>{v.renterEvidence?.viableRenters ?? a.renterContext?.viableRenters ?? "—"}</b></div>
              <div><label>Operators seen</label><b>{a.renterContext?.relevantOperators ?? "—"}</b></div>
            </div>
            {dec?.new?.recommendedMonetizationModel && <p className="note"><b>Recommended monetization:</b> {dec.new.recommendedMonetizationModel}</p>}
            <p className="note" style={{ marginTop: 8 }}>Ticket, margin and close rate are HUMAN_ASSUMED and drive D and F. Wave 1 replaces them with observed CPL, lead value and realized rent.{v.renterEvidence?.note ? ` ${v.renterEvidence.note}` : ""}</p>
            {a.successCondition && (<><h3 style={{ marginTop: 14 }}>Pre-registered outcomes</h3>
              <p className="note"><b>Success:</b> {a.successCondition}</p>
              <p className="note" style={{ marginTop: 6 }}><b>Failure:</b> {a.failureCondition}</p></>)}
          </div>

          <div>{/* -------- Evidence -------- */}
            <h3 style={{ marginTop: 0 }}>Local content depth <Badge status={v.localDepth.verdict} /> &nbsp; Visual assets <Badge status={v.visual.verdict} /></h3>
            <p className="note"><b>Have:</b> {v.localDepth.evidence.availableSignals.join(" · ") || "none"}</p>
            <p className="note"><b>Missing (never fabricated):</b> {v.localDepth.evidence.missingSignals.join(" · ")}</p>
            <p className="note" style={{ marginTop: 8 }}><b>Suggested visuals:</b> {v.visual.evidence.suggestedAssets.join(" · ")}</p>
            <h3 style={{ marginTop: 16 }}>Provenance</h3>
            <div className="prov">
              {Object.entries(a.evidenceRefs || {}).map(([k, val]) => (
                <div key={k}>{k}: {typeof val === "object" ? JSON.stringify(val) : String(val)}</div>))}
              <div>validation: {v.version} · scoring: {a.dimensionAVersion || "ai-v1.0.0"} · organic: {a.organicVersion || "organic-v1.2"}</div>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
