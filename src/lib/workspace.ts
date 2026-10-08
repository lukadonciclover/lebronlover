import { cookies, headers } from "next/headers";
import { DEMO_WORKSPACE_ID, WORKSPACE_COOKIE, WORKSPACE_HEADER } from "@/lib/constants";

/**
 * Resolve the current workspace id.
 *
 * The proxy assigns every visitor a stable, isolated workspace via an httpOnly
 * cookie and mirrors it into a request header so the very first request already
 * has a value. Server-side authorisation always filters by this id.
 */
export async function getWorkspaceId(): Promise<string> {
  const headerStore = await headers();
  const headerValue = headerStore.get(WORKSPACE_HEADER)?.trim();
  if (headerValue) return headerValue;

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(WORKSPACE_COOKIE)?.value?.trim();
  if (cookieValue) return cookieValue;

  // Should not happen while the proxy matcher covers the route; degrade safely.
  return "anonymous";
}

export function isDemoWorkspace(workspaceId: string): boolean {
  return workspaceId === DEMO_WORKSPACE_ID;
}

/** Demo records are readable by anyone but writable by no one. */
export function canWrite(workspaceId: string): boolean {
  return !isDemoWorkspace(workspaceId) && workspaceId !== "anonymous";
}