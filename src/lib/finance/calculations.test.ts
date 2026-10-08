import { describe, expect, it } from "vitest";
import {
  deriveEbitda,
  deriveFreeCashFlow,
  enterpriseValue,
  evToEbitda,
  evToRevenue,
  fcfYield,
  impliedUpside,
  marketCap,
  netDebt,
  peRatio,
  revenueCagr,
  revenueGrowth,
  returnOnEquity,
} from "@/lib/finance/calculations";
import { computeMetrics, type MetricsInput } from "@/lib/finance/metrics";

const fixture: MetricsInput = {
  sharePrice: 10,
  sharesOutstanding: 100,
  cash: 20,
  totalDebt: 10,
  reportingCurrency: "USD",
  quoteCurrency: "USD",
  targetPrice: 12,
  statements: [
    { fiscalYear: 2023, revenue: 80 },
    { fiscalYear: 2024, revenue: 100 },
    {
      fiscalYear: 2025,
      revenue: 120,
      ebitda: 30,
      operatingIncome: 25,
      netIncome: 20,
      freeCashFlow: 18,
    },
  ],
};

function value(result: ReturnType<typeof marketCap>): number {
  if (result.status !== "ok") throw new Error(`expected ok, got ${result.reason}`);
  return result.value;
}

describe("financial calculations — QA fixture", () => {
  it("computes market cap, net debt and enterprise value", () => {
    expect(value(marketCap(10, 100))).toBe(1_000);
    expect(value(netDebt(10, 20))).toBe(-10);
    expect(value(enterpriseValue(1_000, 10, 20))).toBe(990);
  });

  it("preserves zero cash and zero debt as valid values", () => {
    expect(value(netDebt(0, 0))).toBe(0);
    expect(value(enterpriseValue(1_000, 0, 0))).toBe(1_000);
    expect(value(marketCap(0, 100))).toBe(0);
  });

  it("computes growth and CAGR over elapsed fiscal years", () => {
    expect(value(revenueGrowth(120, 100))).toBeCloseTo(0.2, 10);
    expect(value(revenueCagr(120, 80, 2))).toBeCloseTo(0.224744871391589, 8);
  });

  it("computes valuation and profitability ratios", () => {
    expect(value(evToRevenue(990, 120))).toBeCloseTo(8.25, 10);
    expect(value(evToEbitda(990, 30))).toBeCloseTo(33, 10);
    expect(value(peRatio(1_000, 20))).toBeCloseTo(50, 10);
    expect(value(fcfYield(18, 1_000))).toBeCloseTo(0.018, 10);
    expect(value(impliedUpside(12, 10))).toBeCloseTo(0.2, 10);
  });

  it("returns the full metric set for the fixture", () => {
    const metrics = computeMetrics(fixture);
    expect(metrics.latestFiscalYear).toBe(2025);
    expect(metrics.years).toBe(2);
    expect(metrics.latestRevenue).toBe(120);
    expect(metrics.currencyMismatch).toBe(false);
    expect(value(metrics.marketCap)).toBe(1_000);
    expect(value(metrics.netDebt)).toBe(-10);
    expect(metrics.netCash).toBe(true);
    expect(value(metrics.enterpriseValue)).toBe(990);
    expect(value(metrics.revenueGrowth)).toBeCloseTo(0.2, 10);
    expect(value(metrics.revenueCagr)).toBeCloseTo(0.224744871391589, 8);
    expect(value(metrics.ebitdaMargin)).toBeCloseTo(0.25, 10);
    expect(value(metrics.operatingMargin)).toBeCloseTo(25 / 120, 10);
    expect(value(metrics.netMargin)).toBeCloseTo(20 / 120, 10);
    expect(value(metrics.fcfMargin)).toBeCloseTo(0.15, 10);
    expect(value(metrics.evToRevenue)).toBeCloseTo(8.25, 10);
    expect(value(metrics.evToEbitda)).toBeCloseTo(33, 10);
    expect(value(metrics.peRatio)).toBeCloseTo(50, 10);
    expect(value(metrics.fcfYield)).toBeCloseTo(0.018, 10);
    expect(value(metrics.impliedUpside)).toBeCloseTo(0.2, 10);
  });
});

describe("negative earnings and unsuitable denominators", () => {
  it("marks negative EBITDA as not meaningful", () => {
    const result = evToEbitda(990, -5);
    expect(result.status).toBe("na");
    if (result.status === "na") expect(result.reason).toBe("not_meaningful");
  });

  it("marks negative net income P/E as not meaningful", () => {
    const result = peRatio(1_000, -20);
    expect(result.status).toBe("na");
  });

  it("marks zero-revenue margins as no ratio", () => {
    const result = evToRevenue(990, 0);
    expect(result.status).toBe("na");
    if (result.status === "na") expect(result.reason).toBe("zero_denominator");
  });

  it("never returns NaN or Infinity", () => {
    const metrics = computeMetrics({
      sharePrice: null,
      sharesOutstanding: 100,
      statements: [{ fiscalYear: 2025, revenue: null }],
    });
    const numericKeys = [
      "marketCap",
      "netDebt",
      "enterpriseValue",
      "revenueGrowth",
      "revenueCagr",
      "grossMargin",
      "ebitdaMargin",
      "operatingMargin",
      "netMargin",
      "fcfMargin",
      "evToRevenue",
      "evToEbitda",
      "peRatio",
      "fcfYield",
      "returnOnEquity",
      "impliedUpside",
    ] as const;
    for (const key of numericKeys) {
      const entry = metrics[key];
      if (entry.status === "ok") expect(Number.isFinite(entry.value)).toBe(true);
    }
  });
});

describe("currency handling", () => {
  it("refuses cross-currency ratios when no FX rate is supplied", () => {
    const metrics = computeMetrics({
      ...fixture,
      quoteCurrency: "EUR",
      fxRateToQuote: null,
    });
    expect(metrics.currencyMismatch).toBe(true);
    expect(metrics.enterpriseValue.status).toBe("na");
    if (metrics.enterpriseValue.status === "na") {
      expect(metrics.enterpriseValue.reason).toBe("currency_mismatch");
    }
    // Reporting-currency margins are unaffected by the FX mismatch.
    expect(value(metrics.ebitdaMargin)).toBeCloseTo(0.25, 10);
  });

  it("applies an explicit FX rate when provided", () => {
    const metrics = computeMetrics({
      ...fixture,
      quoteCurrency: "EUR",
      fxRateToQuote: 0.9,
    });
    expect(metrics.currencyMismatch).toBe(false);
    // EV in EUR = 1000 + (10 - 20) * 0.9 = 991
    expect(value(metrics.enterpriseValue)).toBeCloseTo(991, 6);
  });
});

describe("derived values", () => {
  it("derives EBITDA only from operating income and D&A", () => {
    expect(deriveEbitda(25, 5)).toEqual({ status: "ok", value: 30 });
    expect(deriveEbitda(25, null).status).toBe("na");
  });

  it("derives free cash flow with a consistent capex sign convention", () => {
    expect(deriveFreeCashFlow(100, 40)).toEqual({ status: "ok", value: 60 });
    expect(deriveFreeCashFlow(100, -40)).toEqual({ status: "ok", value: 60 });
  });

  it("labels a derived EBITDA in computeMetrics", () => {
    const metrics = computeMetrics({
      ...fixture,
      statements: [
        { fiscalYear: 2024, revenue: 100, operatingIncome: 20, depreciationAmortisation: 5 },
        { fiscalYear: 2025, revenue: 120, operatingIncome: 25, depreciationAmortisation: 5 },
      ],
    });
    expect(value(metrics.ebitdaMargin)).toBeCloseTo(30 / 120, 10);
  });
});

describe("ROE convention", () => {
  it("uses average beginning/end equity", () => {
    expect(returnOnEquity(20, 100, 140)).toEqual({ status: "ok", value: 20 / 120 });
  });

  it("returns N/A when beginning equity is unavailable", () => {
    expect(returnOnEquity(20, null, 140).status).toBe("na");
  });
});