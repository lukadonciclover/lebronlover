import { beforeEach, describe, expect, it } from "vitest";
import { createDb, ensureSchema, type DatabaseHandle } from "@/lib/db/client";
import { importCompany } from "@/lib/providers";

let handle: DatabaseHandle;

beforeEach(async () => {
  handle = createDb(":memory:");
  await ensureSchema(handle.client);
});

describe("import service (synthetic demo adapter, no network)", () => {
  it("assembles a draft with statements, quote and valuation inputs", async () => {
    const outcome = await importCompany(handle.db, "demo", "HELIO");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { draft } = outcome;
    expect(draft.isDemo).toBe(true);
    expect(draft.source).toBe("Synthetic demo data");
    expect(draft.statements.length).toBeGreaterThanOrEqual(3);
    expect(draft.market.sharePrice).toBeGreaterThan(0);
    expect(draft.market.sharesOutstanding).toBeGreaterThan(0);
    // Valuation cash/debt are taken from the latest annual balance sheet.
    expect(draft.valuation.cash).not.toBeNull();
    expect(draft.valuation.totalDebt).not.toBeNull();
    // Statements are in reporting-currency millions.
    const latest = draft.statements.at(-1)!;
    expect(latest.revenue).not.toBeNull();
    expect(latest.revenue!).toBeLessThan(10_000);
    expect(latest.originalUnits).toBe("units");
  });

  it("serves a repeated import from cache with the same retrieval date", async () => {
    const first = await importCompany(handle.db, "demo", "MRDG");
    const second = await importCompany(handle.db, "demo", "MRDG");
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.draft.retrievalDate).toBe(first.draft.retrievalDate);
    }
  });

  it("reports an unsupported provider without throwing", async () => {
    const outcome = await importCompany(handle.db, "not-a-provider", "AAPL");
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe("unsupported");
      expect(outcome.cached).toBeNull();
    }
  });
});