import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, expectedAuthToken } from "@/lib/authToken";

// Paths reachable without a valid session: the login page itself and the
// auth endpoints. Everything else (dashboard + all other /api routes) is gated.
const PUBLIC_PATHS = new Set<string>(["/", "/api/login", "/api/logout"]);

export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;

  // No password configured → gate disabled (open access). Lets the app run
  // locally without setup; set APP_PASSWORD in production to enable the gate.
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const expected = await expectedAuthToken(password);

  if (token && token === expected) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "未授权：请先登录" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
