import { NextResponse } from 'next/server';
import { appPassword, sessionToken } from '@/lib/auth';

export async function POST(req: Request) {
  const { password } = await req.json();
  if (password !== appPassword()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set('rros_session', sessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return res;
}
