import { describe, expect, it } from "vitest";
import {
  avNumber,
  classifyAlphaVantageError,
  mergeAlphaVantageStatements,
  parseGlobalQuote,
  parseOverview,
  parseSearchResponse,
} from "@/lib/providers/alpha-vantage";

describe("Alpha Vantage parsing", () => {
  it("parses strings, zeros and missing sentinels", () => {
    expect(avNumber("None")).toBeNull();
    expect(avNumber("")).toBeNull();
    expect(avNumber("0")).toBe(0);
    expect(avNumber("123.45")).toBe(123.45);
    expect(avNumber("not a number")).toBeNull();
  });

  it("classifies quota, credential and data errors", () => {
    expect(classifyAlphaVantageError({ Note: "rate limit" })?.code).toBe("quota_exhausted");
    expect(classifyAlphaVantageError({ Information: "Invalid API key" })?.code).toBe(
      "invalid_credentials",
    );
    expect(classifyAlphaVantageError({ Information: "premium endpoint" })?.code).toBe(
      "premium_endpoint",
    );
    expect(classifyAlphaVantageError({ "Error Message": "Invalid API call" })?.code).toBe("no_data");
    expect(classifyAlphaVantageError({ bestMatches: [] })).toBeNull();
  });

  it("prioritises exact ticker matches and never invents an exchange", () => {
    const results = parseSearchResponse(
      {
        bestMatches: [
          {
            "1. symbol": "MSFT",
            "2. name": "Microsoft Corporation",
            "3. type": "Equity",
            "4. region": "United States",
            "8. currency": "USD",
            "9. matchScore": "0.9",
          },
          {
            "1. symbol": "AAPL",
            "2. name": "Apple Inc",
            "3. type": "Equity",
            "4. region": "United States",
            "8. currency": "USD",
            "9. matchScore": "0.8",
          },
        ],
      },
      "AAPL",
    );
    expect(results[0].symbol).toBe("AAPL");
    expect(results[0].exchange).toBeNull();
    expect(results[0].region).toBe("United States");
    expect(results[0].securityType).toBe("Ordinary Share");
  });

  it("recognises depositary receipts and ETFs", () => {
    const results = parseSearchResponse(
      {
        bestMatches: [
          { "1. symbol": "BABA", "2. name": "Alibaba ADR", "3. type": "Depositary Receipt" },
          { "1. symbol": "SPY", "2. name": "SPDR S&P 500", "3. type": "ETF" },
        ],
      },
      "x",
    );
    expect(results.find((result) => result.symbol === "BABA")?.securityType).toBe(
      "Depositary Receipt",
    );
    expect(results.find((result) => result.symbol === "SPY")?.securityType).toBe("ETF");
  });

  it("parses a global quote", () => {
    const quote = parseGlobalQuote(
      { "Global Quote": { "05. price": "189.12", "07. latest trading day": "2025-01-02" } },
      "USD",
    );
    expect(quote?.price).toBe(189.12);
    expect(quote?.quoteDate).toBe("2025-01-02");
  });

  it("parses an overview into a profile and quote", () => {
    const { profile, quote } = parseOverview(
      {
        Symbol: "AAPL",
        AssetType: "Common Stock",
        Name: "Apple Inc",
        Exchange: "NASDAQ",
        Currency: "USD",
        Country: "USA",
        Sector: "TECHNOLOGY",
        Industry: "ELECTRONIC COMPUTERS",
        SharesOutstanding: "15000000000",
        MarketCapitalization: "3000000000000",
      },
      "AAPL",
    );
    expect(profile.identity.exchange).toBe("NASDAQ");
    expect(profile.reportingCurrency).toBe("USD");
    expect(quote.sharesOutstanding).toBe(15_000_000_000);
  });
});

describe("Alpha Vantage statement merging", () => {
  it("merges the three statements and derives FCF with a labelled origin", () => {
    const statements = mergeAlphaVantageStatements({
      income: [
        {
          fiscalDateEnding: "2025-09-30",
          reportedCurrency: "USD",
          totalRevenue: "1200000",
          ebitda: "300000",
          operatingIncome: "250000",
          netIncome: "200000",
        },
      ],
      balance: [
        {
          fiscalDateEnding: "2025-09-30",
          totalAssets: "5000000",
          totalDebt: "100000",
          cashAndCashEquivalentsAtCarryingValue: "200000",
        },
      ],
      cashflow: [
        {
          fiscalDateEnding: "2025-09-30",
          operatingCashflow: "180000",
          capitalExpenditures: "-40000",
        },
      ],
      currency: "USD",
    });
    const latest = statements.at(-1)!;
    expect(latest.fiscalYear).toBe(2025);
    expect(latest.values.freeCashFlow).toBe(140000);
    expect(latest.fieldMeta?.freeCashFlow).toBe("derived");
    expect(latest.values.revenue).toBe(1_200_000);
    expect(latest.units).toBe("units");
  });

  it("caps the history at five years and orders it chronologically", () => {
    const income = Array.from({ length: 7 }, (_, index) => ({
      fiscalDateEnding: `${2018 + index}-12-31`,
      totalRevenue: "100",
    }));
    const statements = mergeAlphaVantageStatements({
      income,
      balance: [],
      cashflow: [],
      currency: "USD",
    });
    expect(statements).toHaveLength(5);
    expect(statements[0].fiscalYear).toBe(2020);
    expect(statements.at(-1)!.fiscalYear).toBe(2024);
  });
});