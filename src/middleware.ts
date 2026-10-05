import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional owner passcode. When SHOPSENSE_PASSCODE is set, everything that
 * changes the shop's data or spends AI money needs it; reading the dashboard
 * does not. Open the app once as /?key=<passcode> to get a cookie.
 *
 * Left unset for the public judging demo, where anyone may reset the demo shop.
 */
const PROTECTED = [
  /^\/api\/demo\//,
  /^\/api\/ring\/(connect|oauth)/,
  /^\/api\/(shop|cameras|deliveries|sales|clock|advice)/,
];

export function middleware(req: NextRequest) {
  const pass = process.env.SHOPSENSE_PASSCODE;
  if (!pass) return NextResponse.next();

  const key = req.nextUrl.searchParams.get("key");
  if (key !== null) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("key");
    const res = NextResponse.redirect(url);
    if (key === pass) res.cookies.set("ss_key", pass, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 90, path: "/" });
    return res;
  }

  const path = req.nextUrl.pathname;
  const mutating = req.method !== "GET" || path.startsWith("/api/ring/oauth");
  if (mutating && PROTECTED.some((r) => r.test(path)) && req.cookies.get("ss_key")?.value !== pass) {
    return NextResponse.json({ error: "This shop is locked. Open the link with ?key=<passcode> first." }, { status: 401 });
  }
  if (path === "/setup" && req.cookies.get("ss_key")?.value !== pass) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*", "/setup", "/"] };
