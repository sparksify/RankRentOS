import { NextResponse } from 'next/server';
import { insert, rpc } from '@/lib/db';

export const maxDuration = 60;

export async function POST(req: Request) {
  const params = await req.json().catch(() => ({}));
  try {
    // Job budget parameters are recorded for cost governance; qualification
    // itself is free (runs in-database over stored observations).
    await insert('rros_jobs', [{
      type: 'qualification_ui',
      params,
      status: 'running',
      budget_usd: params.budgetUsd ?? null,
      started_at: new Date().toISOString(),
    }]);
    const result = await rpc('rros_qualify');
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
