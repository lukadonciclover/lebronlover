import { beforeEach, describe, expect, it } from "vitest";
import { createDb, ensureSchema, type DatabaseHandle } from "@/lib/db/client";
import { buildCacheKey, cachedFetch, readStale, clearErrorCache } from "@/lib/providers/cache";
import { ProviderError } from "@/lib/errors";

let handle: DatabaseHandle;

beforeEach(async () => {
  handle = createDb(":memory:");
  await ensureSchema(handle.client);
});

describe("persistent cache", () => {
  it("returns a cached value without calling the provider again", async () => {
    const key = buildCacheKey("test", "profile", { symbol: "AAPL", run: Math.random() });
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return { name: "Apple" };
    };
    const first = await cachedFetch({ db: handle.db, provider: "test", kind: "profile", key, fetcher });
    const second = await cachedFetch({ db: handle.db, provider: "test", kind: "profile", key, fetcher });
    expect(calls).toBe(1);
    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(second.value).toEqual({ name: "Apple" });
    expect(second.retrievedAt).toBe(first.retrievedAt);
  });

  it("deduplicates simultaneous requests into a single upstream call", async () => {
    const key = buildCacheKey("test", "search", { q: "nvidia", run: Math.random() });
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 25));
      return ["NVDA"];
    };
    const [a, b, c] = await Promise.all([
      cachedFetch({ db: handle.db, provider: "test", kind: "search", key, fetcher }),
      cachedFetch({ db: handle.db, provider: "test", kind: "search", key, fetcher }),
      cachedFetch({ db: handle.db, provider: "test", kind: "search", key, fetcher }),
    ]);
    expect(calls).toBe(1);
    expect(a.value).toEqual(["NVDA"]);
    expect(b.value).toEqual(["NVDA"]);
    expect(c.value).toEqual(["NVDA"]);
  });

  it("caches quota errors so they are not retried repeatedly", async () => {
    const key = buildCacheKey("test", "statements", { symbol: "XYZ", run: Math.random() });
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      throw new ProviderError("quota_exhausted", { provider: "test" });
    };
    await expect(
      cachedFetch({ db: handle.db, provider: "test", kind: "statements", key, fetcher }),
    ).rejects.toMatchObject({ code: "quota_exhausted" });
    await expect(
      cachedFetch({ db: handle.db, provider: "test", kind: "statements", key, fetcher }),
    ).rejects.toMatchObject({ code: "quota_exhausted" });
    expect(calls).toBe(1);

    // Clearing the error allows a retry.
    await clearErrorCache(handle.db, key);
    await expect(
      cachedFetch({ db: handle.db, provider: "test", kind: "statements", key, fetcher }),
    ).rejects.toMatchObject({ code: "quota_exhausted" });
    expect(calls).toBe(2);
  });

  it("exposes stale values for fallback after a failure", async () => {
    const key = buildCacheKey("test", "statements", { symbol: "OLD", run: Math.random() });
    await cachedFetch({
      db: handle.db,
      provider: "test",
      kind: "statements",
      key,
      fetcher: async () => ({ rows: 3 }),
    });
    const stale = await readStale<{ rows: number }>(handle.db, key);
    expect(stale?.value).toEqual({ rows: 3 });
    expect(stale?.retrievedAt).toBeTruthy();
  });

  it("has no stale fallback for a cached error", async () => {
    const key = buildCacheKey("test", "quote", { symbol: "ERR", run: Math.random() });
    await expect(
      cachedFetch({
        db: handle.db,
        provider: "test",
        kind: "quote",
        key,
        fetcher: async () => {
          throw new ProviderError("invalid_credentials", { provider: "test" });
        },
      }),
    ).rejects.toBeInstanceOf(ProviderError);
    expect(await readStale(handle.db, key)).toBeNull();
  });
});