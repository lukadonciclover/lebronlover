import { describe, expect, it } from "vitest";
import {
  elapsedYears,
  hasValue,
  normalizeStatement,
  normalizeStatements,
  sortStatements,
  toMillions,
} from "@/lib/finance/normalize";

describe("unit normalisation", () => {
  it("converts each supported unit scale into millions", () => {
    expect(toMillions(1_000_000, "units")).toBe(1);
    expect(toMillions(1_000, "thousands")).toBe(1);
    expect(toMillions(1, "millions")).toBe(1);
    expect(toMillions(0.001, "billions")).toBe(1);
  });

  it("never double-converts values already expressed in millions", () => {
    expect(toMillions(1, null)).toBe(1);
    expect(toMillions(1, undefined)).toBe(1);
  });

  it("preserves null and rejects non-finite values", () => {
    expect(toMillions(null, "units")).toBeNull();
    expect(toMillions(undefined, "units")).toBeNull();
    expect(toMillions(Number.NaN, "units")).toBeNull();
    expect(toMillions(Number.POSITIVE_INFINITY, "units")).toBeNull();
  });
});

describe("missing versus zero versus negative", () => {
  it("keeps a missing value as null and a zero as zero", () => {
    const statement = normalizeStatement({
      fiscalYear: 2025,
      values: { revenue: undefined, netIncome: 0, freeCashFlow: -12 },
      units: "millions",
    });
    expect(statement.revenue).toBeNull();
    expect(statement.netIncome).toBe(0);
    expect(statement.freeCashFlow).toBe(-12);
  });

  it("hasValue treats zero as present", () => {
    expect(hasValue(0)).toBe(true);
    expect(hasValue(null)).toBe(false);
    expect(hasValue(Number.NaN)).toBe(false);
  });
});

describe("fiscal period ordering", () => {
  it("sorts statements chronologically regardless of input order", () => {
    const sorted = sortStatements([
      { fiscalYear: 2025, periodEnd: "2025-12-31" },
      { fiscalYear: 2023, periodEnd: "2023-12-31" },
      { fiscalYear: 2024, periodEnd: "2024-12-31" },
    ]);
    expect(sorted.map((statement) => statement.fiscalYear)).toEqual([2023, 2024, 2025]);
  });

  it("normalises and sorts in one step", () => {
    const normalised = normalizeStatements([
      { fiscalYear: 2025, values: { revenue: 120 }, units: "millions" },
      { fiscalYear: 2023, values: { revenue: 80 }, units: "millions" },
    ]);
    expect(normalised[0].fiscalYear).toBe(2023);
    expect(normalised[1].fiscalYear).toBe(2025);
  });

  it("counts actual elapsed years", () => {
    expect(elapsedYears(2023, 2025)).toBe(2);
    expect(elapsedYears(2025, 2025)).toBe(0);
  });
});