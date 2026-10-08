import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { cacheEntries } from "@/lib/db/schema";
import { ProviderError, type ProviderErrorCode } from "@/lib/errors";

export type CacheKind = "search" | "profile" | "statements" | "quote";

export type CacheResult<T> = {
  value: T;
  /** ISO timestamp of when the value was originally retrieved. */
  retrievedAt: string;
  fromCache: boolean;
};

function envMinutes(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function cacheTtlMs(kind: CacheKind): number {
  const minutes = {
    search: envMinutes("CACHE_TTL_SEARCH_MINUTES", 60 * 24),
    profile: envMinutes("CACHE_TTL_PROFILE_MINUTES", 60 * 24),
    statements: envMinutes("CACHE_TTL_STATEMENTS_MINUTES", 60 * 24),
    quote: envMinutes("CACHE_TTL_QUOTE_MINUTES", 15),
  }[kind];
  return minutes * 60_000;
}

function errorTtlMs(code: ProviderErrorCode): number {
  const short = envMinutes("CACHE_TTL_ERROR_MINUTES", 10) * 60_000;
  const long = envMinutes("CACHE_TTL_HARD_ERROR_MINUTES", 60 * 6) * 60_000;
  switch (code) {
    case "invalid_credentials":
    case "quota_exhausted":
    case "not_configured":
    case "premium_endpoint":
    case "unsupported":
      return long;
    default:
      return short;
  }
}

/** Cache keys must distinguish provider, resource and parameters. */
export function buildCacheKey(
  provider: string,
  kind: CacheKind,
  params: Record<string, string | number> = {},
): string {
  const parts = Object.keys(params)
    .sort()
    .map((key) => `${key}=${String(params[key]).toLowerCase()}`);
  return [provider, kind, ...parts].join(":");
}

type StoredEntry = {
  key: string;
  provider: string;
  kind: string;
  payload: string;
  isError: boolean;
  createdAt: number;
  expiresAt: number;
};

async function readEntry(db: Db, key: string): Promise<StoredEntry | null> {
  const row = await db.select().from(cacheEntries).where(eq(cacheEntries.key, key)).get();
  if (!row) return null;
  return {
    key: row.key,
    provider: row.provider,
    kind: row.kind,
    payload: row.payload,
    isError: Boolean(row.isError),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

async function writeEntry(
  db: Db,
  entry: Pick<StoredEntry, "key" | "provider" | "kind" | "payload" | "isError" | "expiresAt"> & {
    createdAt: number;
  },
): Promise<void> {
  await db
    .insert(cacheEntries)
    .values(entry)
    .onConflictDoUpdate({
      target: cacheEntries.key,
      set: {
        payload: entry.payload,
        isError: entry.isError,
        createdAt: entry.createdAt,
        expiresAt: entry.expiresAt,
      },
    })
    .run();
}

async function removeEntry(db: Db, key: string): Promise<void> {
  await db.delete(cacheEntries).where(eq(cacheEntries.key, key)).run();
}

function parsePayload<T>(entry: StoredEntry): T {
  return JSON.parse(entry.payload) as T;
}

const globalForCache = globalThis as typeof globalThis & {
  __ipcInflight?: Map<string, Promise<unknown>>;
};

function inflight(): Map<string, Promise<unknown>> {
  if (!globalForCache.__ipcInflight) globalForCache.__ipcInflight = new Map();
  return globalForCache.__ipcInflight;
}

/**
 * Read-through cache with request deduplication.
 *
 * - Fresh entries are returned without touching the provider.
 * - Simultaneous requests for the same key share a single upstream call.
 * - Provider failures are cached (with a short TTL) so exhausted quotas and bad
 *   credentials are not hammered. Non-retryable failures use a longer TTL.
 */
export async function cachedFetch<T>(options: {
  db: Db;
  provider: string;
  kind: CacheKind;
  key: string;
  fetcher: () => Promise<T>;
}): Promise<CacheResult<T>> {
  const { db, provider, kind, key, fetcher } = options;
  const existing = await readEntry(db, key);

  if (existing && existing.expiresAt > Date.now()) {
    if (existing.isError) {
      const stored = parsePayload<{ code: ProviderErrorCode; message: string }>(existing);
      throw new ProviderError(stored.code, { message: stored.message, provider });
    }
    return {
      value: parsePayload<T>(existing),
      retrievedAt: new Date(existing.createdAt).toISOString(),
      fromCache: true,
    };
  }

  const pending = inflight().get(key);
  if (pending) {
    return (await pending) as CacheResult<T>;
  }

  const promise = (async (): Promise<CacheResult<T>> => {
    try {
      const value = await fetcher();
      const createdAt = Date.now();
      await writeEntry(db, {
        key,
        provider,
        kind,
        payload: JSON.stringify(value),
        isError: false,
        createdAt,
        expiresAt: createdAt + cacheTtlMs(kind),
      });
      return { value, retrievedAt: new Date(createdAt).toISOString(), fromCache: false };
    } catch (cause) {
      const error = ProviderError.from(cause, provider);
      const createdAt = Date.now();
      await writeEntry(db, {
        key,
        provider,
        kind,
        payload: JSON.stringify({ code: error.code, message: error.message }),
        isError: true,
        createdAt,
        expiresAt: createdAt + errorTtlMs(error.code),
      });
      throw error;
    }
  })();

  inflight().set(key, promise);
  try {
    return await promise;
  } finally {
    inflight().delete(key);
  }
}

/** Return the most recent successful cached value even if it has expired. */
export async function readStale<T>(
  db: Db,
  key: string,
): Promise<{ value: T; retrievedAt: string } | null> {
  const entry = await readEntry(db, key);
  if (!entry || entry.isError) return null;
  try {
    return { value: parsePayload<T>(entry), retrievedAt: new Date(entry.createdAt).toISOString() };
  } catch {
    return null;
  }
}

/** Remove the cached error for a key so a subsequent request can retry. */
export async function clearErrorCache(db: Db, key: string): Promise<void> {
  const entry = await readEntry(db, key);
  if (entry?.isError) await removeEntry(db, key);
}

export async function clearCacheKey(db: Db, key: string): Promise<void> {
  await removeEntry(db, key);
}