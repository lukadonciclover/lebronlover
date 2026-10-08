import { NextResponse, type NextRequest } from "next/server";
import { WORKSPACE_COOKIE, WORKSPACE_HEADER } from "@/lib/constants";

/**
 * Assign every visitor a stable, isolated workspace. The id is written to an
 * httpOnly cookie and mirrored into a request header so the first request
 * already resolves a workspace (before the cookie round-trips).
 */
export function proxy(request: NextRequest) {
  const existing = request.cookies.get(WORKSPACE_COOKIE)?.value?.trim();
  const id = existing || crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(WORKSPACE_HEADER, id);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!existing) {
    response.cookies.set(WORKSPACE_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};