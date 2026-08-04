import { NextResponse } from "next/server";
import { sb } from "../../../lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const runs = await sb("runs?select=id,label,started_at&order=started_at.desc&limit=1");
    if (!runs.length) return NextResponse.json({ runLabel: null, markets: [], pipeline: [] });
    const sel = "select=*,domains(domain,is_winner,winner_reason)";
    const [a, b, pipeline] = await Promise.all([
      sb(`markets?run_id=eq.${runs[0].id}&${sel}&order=score.desc&limit=1000`),
      sb(`markets?run_id=eq.${runs[0].id}&${sel}&order=score.desc&limit=1000&offset=1000`),
      sb("pipeline?select=id,market_id,status,notes,domain_purchased"),
    ]);
    const markets = [...a, ...b].map((m) => ({
      ...m,
      winner: (m.domains || []).find((d) => d.is_winner) || null,
      domains: undefined,
    }));
    return NextResponse.json({ runLabel: runs[0].label, markets, pipeline });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
