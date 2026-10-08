import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";
import { SCHEMA_STATEMENTS } from "@/lib/db/ddl";

export type Db = LibSQLDatabase<typeof schema>;

export type DatabaseHandle = {
  client: Client;
  db: Db;
  close: () => void;
};

export const DEFAULT_DATABASE_URL = "file:./data/investment-pitch-copilot.db";

export function databaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
}

function authToken(): string | undefined {
  return process.env.DATABASE_AUTH_TOKEN?.trim() || undefined;
}

function isLocalFile(url: string): boolean {
  return url.startsWith("file:");
}

/** Create a database handle. Used directly by tests with their own URL. */
export function createDb(url: string = databaseUrl()): DatabaseHandle {
  const client = createClient({ url, authToken: authToken() });
  const db = drizzle(client, { schema });
  return {
    client,
    db,
    close: () => client.close(),
  };
}

/** Run the idempotent DDL. Safe to call repeatedly. */
export async function ensureSchema(client: Client): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await client.execute(statement);
  }
}

type GlobalCache = typeof globalThis & {
  __ipcDb?: DatabaseHandle;
  __ipcSchemaReady?: Promise<void>;
};

const globalForDb = globalThis as GlobalCache;

/** Application-wide singleton handle. */
export function getDatabaseHandle(): DatabaseHandle {
  if (!globalForDb.__ipcDb) {
    const url = databaseUrl();
    if (isLocalFile(url)) {
      // Make sure the containing directory exists for the default file database.
      const path = url.slice("file:".length).split("?")[0];
      if (path && path !== ":memory:") {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const fs = require("node:fs") as typeof import("node:fs");
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const nodePath = require("node:path") as typeof import("node:path");
          fs.mkdirSync(nodePath.dirname(path), { recursive: true });
        } catch {
          // Non-fatal: libsql will report a meaningful error if it cannot open.
        }
      }
    }
    globalForDb.__ipcDb = createDb(url);
  }
  return globalForDb.__ipcDb;
}

export function getDb(): Db {
  return getDatabaseHandle().db;
}

/** Ensure the schema exists exactly once per process. */
export function ensureDatabaseReady(): Promise<void> {
  if (!globalForDb.__ipcSchemaReady) {
    const { client } = getDatabaseHandle();
    globalForDb.__ipcSchemaReady = ensureSchema(client).catch((error) => {
      globalForDb.__ipcSchemaReady = undefined;
      throw error;
    });
  }
  return globalForDb.__ipcSchemaReady;
}