import { NextResponse, type NextRequest } from 'next/server';

// Gate every page behind the login cookie. /login and its API stay open.
// Token derivation matches lib/auth.ts (middleware runs on edge; recompute via Web Crypto).
async function expectedToken(): Promise<string> {
  const password = process.env.APP_PASSWORD ?? 'prosper-batch1-2026';
  const secret = process.env.APP_SECRET ?? 'rros-static-salt-v1';
  const data = new TextEncoder().encode(`${password}:${secret}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }
  const cookie = req.cookies.get('rros_session')?.value;
  if (cookie && cookie === (await expectedToken())) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
