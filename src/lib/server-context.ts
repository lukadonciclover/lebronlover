import { getDb, ensureDatabaseReady, type Db } from "@/lib/db/client";
import { getWorkspaceId } from "@/lib/workspace";

export type WorkspaceContext = {
  db: Db;
  workspaceId: string;
};

/** Ensure the schema exists, then resolve the caller's isolated workspace. */
export async function getWorkspaceContext(): Promise<WorkspaceContext> {
  await ensureDatabaseReady();
  const workspaceId = await getWorkspaceId();
  return { db: getDb(), workspaceId };
}