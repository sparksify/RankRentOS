// Machine-to-machine auth for the Deployment Engine. Uses HANDOFF_TOKEN when set,
// otherwise falls back to APP_PASSWORD. Constant-time compare.
import { timingSafeEqual } from "crypto";

export function checkBearer(req) {
  const token = process.env.HANDOFF_TOKEN || process.env.APP_PASSWORD || "";
  const header = req.headers.get("authorization") || "";
  const got = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !got) return false;
  const a = Buffer.from(got), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
