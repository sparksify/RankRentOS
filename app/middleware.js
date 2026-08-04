import { NextResponse } from "next/server";
import { sessionToken } from "./lib/auth";

// Gate every page behind the login cookie. /login and the login API stay open.
export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }
  const cookie = req.cookies.get("rros_session")?.value;
  if (cookie && cookie === (await sessionToken())) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
