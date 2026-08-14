import { readFileSync } from "fs";
import path from "path";
import { checkBearer } from "../../../../lib/handoff-auth";

export async function GET(req, { params }) {
  if (!checkBearer(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[A-Za-z0-9-]+$/.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  try {
    const p = path.join(process.cwd(), "data", "handoff", "asset-specs", `${id}.json`);
    return Response.json(JSON.parse(readFileSync(p, "utf8")));
  } catch {
    return Response.json({ error: "spec not found" }, { status: 404 });
  }
}
