import { describe, expect, it } from "vitest";
import {
  financialYearsSchema,
  manualAnalysisSchema,
  thesisSchema,
} from "@/lib/validation/schemas";

describe("fiscal year validation", () => {
  it("rejects duplicate fiscal years", () => {
    const result = financialYearsSchema.safeParse([
      { fiscalYear: 2024, revenue: 100 },
      { fiscalYear: 2024, revenue: 120 },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => /duplicated/i.test(issue.message))).toBe(true);
    }
  });

  it("caps the history at five years", () => {
    const years = [2019, 2020, 2021, 2022, 2023, 2024].map((fiscalYear) => ({ fiscalYear }));
    expect(financialYearsSchema.safeParse(years).success).toBe(false);
  });

  it("allows negative profit and cash-flow values", () => {
    const result = financialYearsSchema.safeParse([
      { fiscalYear: 2024, netIncome: -25, freeCashFlow: -10, revenue: 100 },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects negative revenue and negative cash/debt", () => {
    expect(financialYearsSchema.safeParse([{ fiscalYear: 2024, revenue: -1 }]).success).toBe(false);
    expect(
      financialYearsSchema.safeParse([{ fiscalYear: 2024, cashAndEquivalents: -1 }]).success,
    ).toBe(false);
    expect(financialYearsSchema.safeParse([{ fiscalYear: 2024, totalDebt: -1 }]).success).toBe(false);
  });

  it("requires positive shares outstanding when supplied", () => {
    const base = { companyName: "X", ticker: "X", reportingCurrency: "usd" };
    expect(
      manualAnalysisSchema.safeParse({ ...base, years: [{ fiscalYear: 2024 }], sharesOutstanding: -5 })
        .success,
    ).toBe(false);
    expect(
      manualAnalysisSchema.safeParse({ ...base, years: [{ fiscalYear: 2024 }], sharesOutstanding: 0 })
        .success,
    ).toBe(false);
  });

  it("treats empty strings as missing rather than zero", () => {
    const result = financialYearsSchema.parse([{ fiscalYear: "2024", revenue: "", netIncome: "0" }]);
    expect(result[0].revenue).toBeNull();
    expect(result[0].netIncome).toBe(0);
  });
});

describe("thesis validation", () => {
  it("trims and drops empty list items", () => {
    const parsed = thesisSchema.parse({
      recommendation: "Buy",
      targetPrice: "12",
      summary: "  growth story  ",
      catalysts: ["  new product  ", "   ", ""],
      risks: ["competition"],
    });
    expect(parsed.summary).toBe("growth story");
    expect(parsed.catalysts).toEqual(["new product"]);
    expect(parsed.risks).toEqual(["competition"]);
  });

  it("enforces the 1000 character summary limit", () => {
    const result = thesisSchema.safeParse({ summary: "a".repeat(1001) });
    expect(result.success).toBe(false);
  });

  it("accepts an unrated analysis", () => {
    const result = thesisSchema.safeParse({ recommendation: null });
    expect(result.success).toBe(true);
  });

  it("rejects a negative target price", () => {
    expect(thesisSchema.safeParse({ targetPrice: -1 }).success).toBe(false);
  });
});