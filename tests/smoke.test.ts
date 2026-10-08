import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createDb, ensureSchema } from "@/lib/db/client";
import { createAnalysis, getAnalysis, saveStatements } from "@/lib/db/repository";
import { nullableNumber, statementInputSchema } from "@/lib/validation/schemas";

describe("zod preprocessing", () => {
  it("treats empty strings as null and parses numbers", () => {
    expect(nullableNumber.parse("")).toBeNull();
    expect(nullableNumber.parse(null)).toBeNull();
    expect(nullableNumber.parse("12.5")).toBe(12.5);
    expect(nullableNumber.parse(0)).toBe(0);
    expect(nullableNumber.safeParse("abc").success).toBe(false);
    expect(nullableNumber.safeParse("Infinity").success).toBe(false);
  });

  it("validates a statement row", () => {
    const parsed = statementInputSchema.parse({ fiscalYear: "2024", revenue: "100", netIncome: "-5" });
    expect(parsed.fiscalYear).toBe(2024);
    expect(parsed.revenue).toBe(100);
    expect(parsed.netIncome).toBe(-5);
  });

  it("rejects negative revenue", () => {
    expect(statementInputSchema.safeParse({ fiscalYear: 2024, revenue: -1 }).success).toBe(false);
  });

  it("supports zod record", () => {
    const schema = z.record(z.string(), z.enum(["reported", "derived", "manual"]));
    expect(schema.parse({ revenue: "derived" })).toEqual({ revenue: "derived" });
  });
});

describe("libsql database", () => {
  it("creates the schema and preserves untouched values", async () => {
    const handle = createDb(":memory:");
    await ensureSchema(handle.client);
    const created = await createAnalysis(handle.db, {
      workspaceId: "test-ws",
      companyName: "QA Test Company",
      ticker: "QATEST",
      industry: null,
      sector: null,
      exchange: null,
      country: null,
      securityType: null,
      description: null,
      reportingCurrency: "USD",
      quoteCurrency: "USD",
      sharePrice: 10,
      quoteDate: null,
      sharesOutstanding: 100,
      sharesOutstandingDate: null,
      marketCap: null,
      marketCapDate: null,
      cash: 20,
      cashDate: null,
      totalDebt: 10,
      debtDate: null,
      fxRateToQuote: null,
      source: "manual",
      sourceUrl: null,
      retrievalDate: null,
    });
    await saveStatements(handle.db, created.id, [
      { fiscalYear: 2023, revenue: 80 },
      { fiscalYear: 2024, revenue: 100 },
      { fiscalYear: 2025, revenue: 120 },
    ]);
    const before = await getAnalysis(handle.db, created.id);
    expect(before?.statements.find((s) => s.fiscalYear === 2025)?.revenue).toBe(120);

    // Update only 2025 revenue.
    await saveStatements(handle.db, created.id, [{ fiscalYear: 2025, revenue: 125 }]);
    const after = await getAnalysis(handle.db, created.id);
    expect(after?.statements.find((s) => s.fiscalYear === 2025)?.revenue).toBe(125);
    expect(after?.analysis.cash).toBe(20);
    expect(after?.analysis.totalDebt).toBe(10);
    expect(after?.statements).toHaveLength(3);
    handle.close();
  });
});