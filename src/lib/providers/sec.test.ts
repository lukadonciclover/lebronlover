import { describe, expect, it } from "vitest";
import {
  latestSharesOutstanding,
  mapSecFactsToStatements,
  parseTickerFile,
  searchTickers,
  selectAnnualFacts,
  type SecFacts,
} from "@/lib/providers/sec";

describe("SEC ticker lookup", () => {
  const payload = {
    fields: ["cik", "name", "ticker", "exchange"],
    data: [
      [320193, "Apple Inc.", "AAPL", "Nasdaq"],
      [789019, "Microsoft Corporation", "MSFT", "Nasdaq"],
      [1045810, "NVIDIA Corporation", "NVDA", "Nasdaq"],
    ],
  };

  it("parses the SEC ticker file", () => {
    const rows = parseTickerFile(payload);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ cik: "320193", name: "Apple Inc.", ticker: "AAPL", exchange: "Nasdaq" });
  });

  it("ranks exact ticker matches first", () => {
    const results = searchTickers(parseTickerFile(payload), "NVDA");
    expect(results[0].symbol).toBe("NVDA");
    expect(results[0].exchange).toBe("Nasdaq");
  });

  it("matches by company name", () => {
    const results = searchTickers(parseTickerFile(payload), "micro");
    expect(results[0].symbol).toBe("MSFT");
  });

  it("rejects malformed payloads", () => {
    expect(() => parseTickerFile({ nope: true })).toThrow();
  });
});

const facts: SecFacts = {
  "us-gaap": {
    Revenues: {
      units: {
        USD: [
          // Full-year 2024 as originally filed.
          { start: "2024-01-01", end: "2024-12-31", val: 1000, form: "10-K", filed: "2025-02-01", fy: 2024, fp: "FY" },
          // Restated later.
          { start: "2024-01-01", end: "2024-12-31", val: 1050, form: "10-K/A", filed: "2025-05-01", fy: 2024, fp: "FY" },
          // A quarterly figure that must be ignored.
          { start: "2024-10-01", end: "2024-12-31", val: 300, form: "10-Q", filed: "2025-01-15", fy: 2025, fp: "Q1" },
        ],
      },
    },
    OperatingIncomeLoss: {
      units: {
        USD: [
          { start: "2024-01-01", end: "2024-12-31", val: 250, form: "10-K", filed: "2025-02-01" },
        ],
      },
    },
    DepreciationDepletionAndAmortization: {
      units: {
        USD: [
          { start: "2024-01-01", end: "2024-12-31", val: 50, form: "10-K", filed: "2025-02-01" },
        ],
      },
    },
    Assets: {
      units: {
        USD: [{ end: "2024-12-31", val: 5000, form: "10-K", filed: "2025-02-01" }],
      },
    },
    LongTermDebtCurrent: {
      units: {
        USD: [{ end: "2024-12-31", val: 100, form: "10-K", filed: "2025-02-01" }],
      },
    },
    LongTermDebtNoncurrent: {
      units: {
        USD: [{ end: "2024-12-31", val: 400, form: "10-K", filed: "2025-02-01" }],
      },
    },
  },
  dei: {
    EntityCommonStockSharesOutstanding: {
      units: {
        shares: [
          { end: "2024-12-31", val: 500 },
          { end: "2025-03-31", val: 510 },
        ],
      },
    },
  },
};

describe("SEC annual fact selection", () => {
  it("ignores quarterly values and keeps the latest restatement", () => {
    const series = selectAnnualFacts(facts, ["Revenues"], { unit: "monetary", requireDuration: true });
    expect(series.size).toBe(1);
    expect(series.get(2024)?.value).toBe(1050);
    expect(series.get(2024)?.form).toBe("10-K/A");
  });

  it("extracts the latest shares outstanding", () => {
    expect(latestSharesOutstanding(facts)).toBe(510);
  });
});

describe("SEC statement mapping", () => {
  it("maps facts into statements and derives EBITDA and total debt", () => {
    const statements = mapSecFactsToStatements(facts);
    expect(statements).toHaveLength(1);
    const row = statements[0];
    expect(row.fiscalYear).toBe(2024);
    expect(row.values.revenue).toBe(1050);
    expect(row.values.totalDebt).toBe(500);
    expect(row.fieldMeta?.totalDebt).toBe("derived");
    // EBITDA = operating income (250) + D&A (50)
    expect(row.values.ebitda).toBe(300);
    expect(row.fieldMeta?.ebitda).toBe("derived");
    expect(row.currency).toBe("USD");
  });
});