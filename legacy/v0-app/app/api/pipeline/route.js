import { NextResponse } from "next/server";
import { sb } from "../../../lib/config";

export const dynamic = "force-dynamic";

// Upsert a market's pipeline stage.
export async function POST(req) {
  try {
    const { marketId, status, id } = await req.json();
    if (!marketId || !status) return NextResponse.json({ error: "marketId and status required" }, { status: 400 });
    if (id) {
      const [row] = await sb(`pipeline?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
      });
      return NextResponse.json(row);
    }
    const [row] = await sb("pipeline", { method: "POST", body: JSON.stringify({ market_id: marketId, status }) });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
