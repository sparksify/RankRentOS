// Server-side loader for the Decision Cockpit. Reads the versioned validation run
// artifact produced by v2/scripts/run-prepurchase-validation.ts. Read-only: the UI
// never mutates research data.
import { readFileSync } from "fs";
import path from "path";

let cache = null;
export function loadRun() {
  if (cache) return cache;
  const p = path.join(process.cwd(), "data", "cockpit.json");
  cache = JSON.parse(readFileSync(p, "utf8"));
  return cache;
}
export const idOf = (a) => (a.experimentId || `${a.service}-${a.geography}`).replace(/[^a-zA-Z0-9]/g, "-");
export function findAsset(id) {
  return loadRun().assets.find((a) => idOf(a) === id) || null;
}
export const money = (n) => (typeof n === "number" ? `$${n.toLocaleString()}` : "—");
export const num = (n) => (typeof n === "number" ? n.toLocaleString() : "—");
