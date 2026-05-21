import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, expectedAuthToken } from "@/lib/authToken";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const password = process.env.APP_PASSWORD;

  // Gate disabled when no password is configured.
  if (!password) {
    return NextResponse.json({ ok: true, gateDisabled: true });
  }

  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!body.password || body.password !== password) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  const token = await expectedAuthToken(password);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
