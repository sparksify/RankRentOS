import { NextResponse } from 'next/server';
import { patch, select } from '@/lib/db';

const ALLOWED = new Set(['decision', 'notes', 'position', 'locked']);

export async function PATCH(req: Request) {
  const { id, ...body } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(body)) if (ALLOWED.has(k)) updates[k] = v;
  try {
    await patch('rros_batch_targets', `id=eq.${id}`, updates);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Swap a primary with an alternate (replace-from-alternates).
export async function POST(req: Request) {
  const { action, primaryId, alternateId } = await req.json();
  if (action !== 'swap') return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  try {
    const rows = await select<any>('rros_batch_targets', `select=id,role,position&id=in.(${primaryId},${alternateId})`);
    const primary = rows.find((r) => r.id === primaryId);
    const alternate = rows.find((r) => r.id === alternateId);
    if (!primary || !alternate) return NextResponse.json({ error: 'target not found' }, { status: 404 });
    await patch('rros_batch_targets', `id=eq.${primaryId}`, { role: 'alternate', position: alternate.position, decision: 'replaced', updated_at: new Date().toISOString() });
    await patch('rros_batch_targets', `id=eq.${alternateId}`, { role: 'primary', position: primary.position, decision: 'pending', updated_at: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
