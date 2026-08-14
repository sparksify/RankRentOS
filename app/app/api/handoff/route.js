import { readFileSync } from "fs";
import path from "path";
import { checkBearer } from "../../../lib/handoff-auth";

export async function GET(req) {
  if (!checkBearer(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const p = path.join(process.cwd(), "data", "handoff", "manifest.json");
  return Response.json(JSON.parse(readFileSync(p, "utf8")));
}
