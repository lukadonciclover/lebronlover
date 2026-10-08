import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, ensureSchema, type DatabaseHandle } from "@/lib/db/client";
import {
  createAnalysis,
  getAnalysis,
  saveStatements,
  saveThesis,
  updateAnalysis,
} from "@/lib/db/repository";
import { computeAnalysisMetrics } from "@/lib/analysis-service";
import type { AnalysisCreateInput } from "@/lib/db/repository";

const dbPath = join(tmpdir(), `ipc-test-${randomUUID()}.db`);
const dbUrl = `file:${dbPath.replace(/\\/g, "/")}`;
let handle: DatabaseHandle;

const WORKSPACE = "test-workspace";

const createInput: AnalysisCreateInput = {
  workspaceId: WORKSPACE,
  companyName: "QA Test Company",
  ticker: "QATEST",
  industry: "Testing",
  sector: null,
  exchange: null,
  country: null,
  securityType: "Ordinary Share",
  description: null,
  reportingCurrency: "USD",
  quoteCurrency: "USD",
  sharePrice: 10,
  quoteDate: "2025-06-30",
  sharesOutstanding: 100,
  sharesOutstandingDate: "2025-06-30",
  marketCap: null,
  marketCapDate: null,
  cash: 20,
  cashDate: "2025-06-30",
  totalDebt: 10,
  debtDate: "2025-06-30",
  fxRateToQuote: null,
  source: "Manual entry",
  sourceUrl: null,
  retrievalDate: new Date().toISOString(),
};

beforeEach(async () => {
  if (!handle) {
    handle = createDb(dbUrl);
    await ensureSchema(handle.client);
  }
});

afterAll(() => {
  try {
    handle?.close();
    for (const suffix of ["", "-wal", "-shm"]) {
      const file = `${dbPath}${suffix}`;
      if (existsSync(file)) rmSync(file, { force: true });
    }
  } catch {
    // Best-effort cleanup on Windows where the file lock can linger briefly.
  }
});

async function seedFixture() {
  const record = await createAnalysis(handle.db, createInput, [
    { fiscalYear: 2023, revenue: 80, source: "Manual entry", manual: true },
    { fiscalYear: 2024, revenue: 100, source: "Manual entry", manual: true },
    {
      fiscalYear: 2025,
      revenue: 120,
      ebitda: 30,
      operatingIncome: 25,
      netIncome: 20,
      freeCashFlow: 18,
      source: "Manual entry",
      manual: true,
    },
  ]);
  await saveThesis(handle.db, record.id, WORKSPACE, {
    recommendation: "Buy",
    targetPrice: 12,
    summary: "Structural growth story.",
    catalysts: ["New product"],
    risks: ["Competition"],
  });
  return record;
}

describe("data-preserving updates — critical regression", () => {
  it("editing only 2025 revenue preserves cash, debt, EV and the thesis", async () => {
    const record = await seedFixture();

    const before = await getAnalysis(handle.db, record.id, WORKSPACE);
    expect(before?.thesis?.recommendation).toBe("Buy");
    const beforeMetrics = computeAnalysisMetrics(before!.analysis, before!.statements, 12);
    expect(beforeMetrics.enterpriseValue).toEqual({ status: "ok", value: 990 });

    // Edit ONLY 2025 revenue.
    await saveStatements(handle.db, record.id, [{ fiscalYear: 2025, revenue: 125 }]);

    const after = await getAnalysis(handle.db, record.id, WORKSPACE);
    expect(after?.statements.find((s) => s.fiscalYear === 2025)?.revenue).toBe(125);
    // Untouched statements still present.
    expect(after?.statements).toHaveLength(3);
    // Untouched balance-sheet / market values preserved.
    expect(after?.analysis.cash).toBe(20);
    expect(after?.analysis.totalDebt).toBe(10);
    expect(after?.analysis.sharePrice).toBe(10);
    expect(after?.analysis.sharesOutstanding).toBe(100);
    // Thesis preserved.
    expect(after?.thesis).toMatchObject({
      recommendation: "Buy",
      targetPrice: 12,
      summary: "Structural growth story.",
      catalysts: ["New product"],
      risks: ["Competition"],
    });
    const afterMetrics = computeAnalysisMetrics(after!.analysis, after!.statements, 12);
    expect(afterMetrics.enterpriseValue).toEqual({ status: "ok", value: 990 });
  });

  it("distinguishes a cleared field from an untouched field", async () => {
    const record = await seedFixture();
    // Clear cash explicitly.
    await updateAnalysis(handle.db, record.id, { cash: null });
    const after = await getAnalysis(handle.db, record.id, WORKSPACE);
    expect(after?.analysis.cash).toBeNull();
    // Debt was not mentioned, so it is preserved.
    expect(after?.analysis.totalDebt).toBe(10);
  });

  it("saving a thesis does not change financial data", async () => {
    const record = await seedFixture();
    const before = await getAnalysis(handle.db, record.id, WORKSPACE);
    await saveThesis(handle.db, record.id, WORKSPACE, {
      recommendation: "Hold",
      summary: "Reassessed.",
      catalysts: [],
      risks: [],
    });
    const after = await getAnalysis(handle.db, record.id, WORKSPACE);
    expect(after?.statements.map((s) => [s.fiscalYear, s.revenue])).toEqual(
      before?.statements.map((s) => [s.fiscalYear, s.revenue]),
    );
    expect(after?.analysis.cash).toBe(20);
    expect(after?.analysis.totalDebt).toBe(10);
    expect(after?.analysis.sharePrice).toBe(10);
  });
});

describe("persistence across reopen (refresh)", () => {
  it("retains financial data and thesis after reopening the database", async () => {
    const record = await seedFixture();
    await saveStatements(handle.db, record.id, [{ fiscalYear: 2025, revenue: 125 }]);
    handle.close();

    const reopened = createDb(dbUrl);
    await ensureSchema(reopened.client);
    const data = await getAnalysis(reopened.db, record.id, WORKSPACE);
    expect(data?.statements.find((s) => s.fiscalYear === 2025)?.revenue).toBe(125);
    expect(data?.analysis.cash).toBe(20);
    expect(data?.analysis.totalDebt).toBe(10);
    expect(data?.thesis?.recommendation).toBe("Buy");
    handle = reopened;
  });
});

describe("workspace isolation", () => {
  it("does not expose an analysis to another workspace", async () => {
    const record = await createAnalysis(handle.db, { ...createInput }, [{ fiscalYear: 2025, revenue: 1 }]);
    expect(await getAnalysis(handle.db, record.id, "someone-else")).toBeNull();
    expect(await getAnalysis(handle.db, record.id, WORKSPACE)).not.toBeNull();
  });
});