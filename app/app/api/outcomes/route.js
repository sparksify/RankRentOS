import { readFileSync } from "fs";
import path from "path";
import { sb } from "../../../lib/config";
import { checkBearer } from "../../../lib/handoff-auth";

// Closed metric vocabulary, mirrored from the v2 registry's asset.* namespace.
const ALLOWED = new Set([
  "asset.published.date", "asset.indexed.date", "asset.firstimpression.date", "asset.firstrank.date",
  "asset.firstlead.date", "asset.firstrevenue.date", "asset.indexed.days", "asset.firstimpression.days",
  "asset.firstrank.days", "asset.rank.check", "asset.impressions.count", "asset.clicks.count",
  "asset.sessions.count", "asset.calls.count", "asset.forms.count", "asset.leads.count",
  "asset.leads.qualified", "asset.leadvalue.realized", "asset.renter.outreach", "asset.renter.responses",
  "asset.renter.acquired", "asset.rent.monthly", "asset.revenue.total", "asset.cost.operating",
]);
let validIds = null;
function knownExperimentIds() {
  if (validIds) return validIds;
  const m = JSON.parse(readFileSync(path.join(process.cwd(), "data", "handoff", "manifest.json"), "utf8"));
  validIds = new Set(m.specs.map((s) => s.experimentId));
  return validIds;
}

// Append-only outcome ingestion per the Part-2 contract. Every row lands in the
// observations table as OBSERVED evidence from the deployment engine. UNKNOWN is
// never zero: the engine simply omits what it did not measure.
export async function POST(req) {
  if (!checkBearer(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "invalid json" }, { status: 400 }); }
  const obs = Array.isArray(body?.observations) ? body.observations : null;
  if (!obs || !obs.length) return Response.json({ error: "body must be { observations: [...] } with at least one entry" }, { status: 400 });
  if (obs.length > 500) return Response.json({ error: "max 500 observations per request" }, { status: 400 });

  const ids = knownExperimentIds();
  const errors = [];
  const rows = [];
  obs.forEach((o, i) => {
    if (!o || typeof o !== "object") return errors.push(`#${i}: not an object`);
    if (!ids.has(o.experimentId)) return errors.push(`#${i}: unknown experimentId "${o.experimentId}"`);
    if (!ALLOWED.has(o.metric)) return errors.push(`#${i}: metric "${o.metric}" is not in the outcome contract`);
    const isDate = o.metric.endsWith(".date");
    const isJson = o.metric === "asset.rank.check";
    if (isDate && (typeof o.value !== "string" || isNaN(Date.parse(o.value)))) return errors.push(`#${i}: ${o.metric} needs an ISO date string`);
    if (isJson) {
      const v = o.value;
      if (typeof v !== "object" || !v.query || (v.position !== "notFound" && !(Number.isInteger(v.position) && v.position >= 1 && v.position <= 100)))
        return errors.push(`#${i}: asset.rank.check needs { query, position: 1-100 | "notFound" } — never 0 or 101`);
    }
    if (!isDate && !isJson && typeof o.value !== "number") return errors.push(`#${i}: ${o.metric} needs a numeric value`);
    rows.push({
      subject_type: "asset", subject_id: o.experimentId, metric: o.metric,
      value: isJson ? JSON.stringify(o.value) : o.value,
      basis: "OBSERVED", source: `deployment-engine:${body.engineVersion || "v1"}${o.period ? `:${o.period}` : ""}`,
      confidence: 0.95, observed_at: new Date(o.observedAt || Date.now()).toISOString(), legacy: false,
    });
  });
  if (errors.length) return Response.json({ error: "validation failed — nothing written", details: errors.slice(0, 20) }, { status: 422 });

  const written = await sb("observations", { method: "POST", body: JSON.stringify(rows) });
  return Response.json({ ok: true, written: written.length });
}
