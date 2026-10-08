import { z } from "zod";
import { ProviderError } from "@/lib/errors";
import { fetchJson } from "@/lib/providers/http";
import type { ProviderAdapter, ProviderProfile, ProviderQuote, ProviderStatements } from "@/lib/providers/types";
import type { RawAnnualStatement } from "@/lib/finance/types";
import type { CompanySearchResult, SecurityType } from "@/lib/finance/types";
import { deriveFreeCashFlow } from "@/lib/finance/calculations";

const BASE_URL = "https://www.alphavantage.co/query";

/** Alpha Vantage encodes missing numbers as the string "None" (or ""). */
export function avNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "none" || trimmed.toLowerCase() === "nan") {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function classifyAlphaVantageError(payload: unknown): ProviderError | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const note = typeof record["Note"] === "string" ? record["Note"] : null;
  const info = typeof record["Information"] === "string" ? record["Information"] : null;
  const errorMessage = typeof record["Error Message"] === "string" ? record["Error Message"] : null;

  if (errorMessage) {
    return new ProviderError("no_data", { provider: "alpha_vantage", message: errorMessage });
  }
  if (note) {
    return new ProviderError("quota_exhausted", { provider: "alpha_vantage", message: note });
  }
  if (info) {
    const lower = info.toLowerCase();
    if (lower.includes("invalid api key") || lower.includes("apikey") || lower.includes("api key")) {
      return new ProviderError("invalid_credentials", { provider: "alpha_vantage", message: info });
    }
    if (lower.includes("premium") || lower.includes("subscribe")) {
      return new ProviderError("premium_endpoint", { provider: "alpha_vantage", message: info });
    }
    if (lower.includes("rate limit") || lower.includes("thank you") || lower.includes("frequency")) {
      return new ProviderError("quota_exhausted", { provider: "alpha_vantage", message: info });
    }
    return new ProviderError("upstream_failure", { provider: "alpha_vantage", message: info });
  }
  return null;
}

export function avSecurityType(raw: unknown): SecurityType | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value.includes("depositary") || value.includes("adr") || value.includes("ads")) {
    return "Depositary Receipt";
  }
  if (value.includes("etf") || value.includes("exchange traded")) return "ETF";
  if (value.includes("fund")) return "Fund";
  if (value.includes("preferred")) return "Preferred Share";
  if (value.includes("equity") || value.includes("common") || value.includes("stock")) {
    return "Ordinary Share";
  }
  return null;
}

const bestMatchesSchema = z.object({
  bestMatches: z.array(z.record(z.string(), z.unknown())).optional(),
});

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function parseSearchResponse(payload: unknown, query: string): CompanySearchResult[] {
  const error = classifyAlphaVantageError(payload);
  if (error) throw error;
  const parsed = bestMatchesSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ProviderError("malformed_response", { provider: "alpha_vantage" });
  }
  const matches = parsed.data.bestMatches ?? [];
  const normalisedQuery = query.trim().toLowerCase();

  return matches
    .map((match): CompanySearchResult => {
      const symbol = readString(match, "1. symbol") ?? "";
      const name = readString(match, "2. name") ?? symbol;
      const type = avSecurityType(match["3. type"]);
      const region = readString(match, "4. region");
      const currency = readString(match, "8. currency");
      const matchScore = avNumber(match["9. matchScore"]);
      const symbolLower = symbol.toLowerCase();
      let rank = 100;
      if (symbolLower === normalisedQuery) rank = 0;
      else if (symbolLower.startsWith(normalisedQuery)) rank = 10;
      else if (name.toLowerCase().startsWith(normalisedQuery)) rank = 20;
      if (typeof matchScore === "number") rank += (1 - matchScore) * 10;
      return {
        provider: "alpha_vantage",
        symbol,
        name,
        // The symbol-search endpoint does not expose an exchange; never invent one.
        exchange: null,
        country: null,
        region,
        securityType: type,
        currency,
        dataSource: "Alpha Vantage",
        rank,
      };
    })
    .filter((result) => result.symbol)
    .sort((a, b) => (a.rank ?? 100) - (b.rank ?? 100));
}

const overviewSchema = z.record(z.string(), z.unknown());

export function parseOverview(
  payload: unknown,
  symbol: string,
): { profile: ProviderProfile; quote: ProviderQuote } {
  const error = classifyAlphaVantageError(payload);
  if (error) throw error;
  const parsed = overviewSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ProviderError("malformed_response", { provider: "alpha_vantage" });
  }
  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    throw new ProviderError("no_data", { provider: "alpha_vantage", message: `No profile for ${symbol}.` });
  }
  const currency = readString(data, "Currency");
  const sharesOutstanding = avNumber(data["SharesOutstanding"]);
  const marketCap = avNumber(data["MarketCapitalization"]);
  const profile: ProviderProfile = {
    identity: {
      name: readString(data, "Name") ?? symbol,
      ticker: readString(data, "Symbol") ?? symbol,
      exchange: readString(data, "Exchange"),
      country: readString(data, "Country"),
      sector: readString(data, "Sector"),
      industry: readString(data, "Industry"),
      description: readString(data, "Description"),
      securityType: avSecurityType(data["AssetType"]) ?? "Ordinary Share",
    },
    reportingCurrency: currency,
    quoteCurrency: currency,
    source: "Alpha Vantage",
    sourceUrl: "https://www.alphavantage.co/",
    externalId: readString(data, "CIK"),
  };
  const quote: ProviderQuote = {
    price: null,
    quoteDate: null,
    currency,
    sharesOutstanding,
    sharesOutstandingDate: null,
    marketCap,
    marketCapDate: null,
    source: "Alpha Vantage",
  };
  return { profile, quote };
}

export function parseGlobalQuote(payload: unknown, currency: string | null): ProviderQuote | null {
  const error = classifyAlphaVantageError(payload);
  if (error) throw error;
  if (!payload || typeof payload !== "object") {
    throw new ProviderError("malformed_response", { provider: "alpha_vantage" });
  }
  const record = (payload as Record<string, unknown>)["Global Quote"];
  if (!record || typeof record !== "object") return null;
  const quoteRecord = record as Record<string, unknown>;
  const price = avNumber(quoteRecord["05. price"]);
  if (price === null) return null;
  return {
    price,
    quoteDate: readString(quoteRecord, "07. latest trading day"),
    currency,
    sharesOutstanding: null,
    sharesOutstandingDate: null,
    marketCap: null,
    marketCapDate: null,
    source: "Alpha Vantage",
  };
}

type AnnualReport = Record<string, unknown>;

function annualReports(payload: unknown, endpoint: string): { reports: AnnualReport[]; currency: string | null } {
  const error = classifyAlphaVantageError(payload);
  if (error) throw error;
  if (!payload || typeof payload !== "object") {
    throw new ProviderError("malformed_response", { provider: "alpha_vantage" });
  }
  const reports = (payload as Record<string, unknown>).annualReports;
  if (!Array.isArray(reports)) {
    throw new ProviderError("malformed_response", {
      provider: "alpha_vantage",
      message: `Missing annualReports in ${endpoint}.`,
    });
  }
  const first = reports[0] as AnnualReport | undefined;
  const currency = first ? readString(first, "reportedCurrency") : null;
  return { reports: reports as AnnualReport[], currency };
}

function fiscalYearOf(report: AnnualReport): number | null {
  const end = readString(report, "fiscalDateEnding");
  if (!end) return null;
  const year = Number(end.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

const INCOME_MAP: Record<string, string> = {
  totalRevenue: "revenue",
  costOfRevenue: "costOfRevenue",
  grossProfit: "grossProfit",
  ebitda: "ebitda",
  depreciationAndAmortization: "depreciationAmortisation",
  operatingIncome: "operatingIncome",
  netIncome: "netIncome",
  reportedEPS: "eps",
};

const BALANCE_MAP: Record<string, string> = {
  cashAndCashEquivalentsAtCarryingValue: "cashAndEquivalents",
  cashAndShortTermInvestments: "cashAndEquivalents",
  shortTermInvestments: "shortTermInvestments",
  totalAssets: "totalAssets",
  totalCurrentAssets: "currentAssets",
  totalCurrentLiabilities: "currentLiabilities",
  shortTermDebt: "shortTermDebt",
  longTermDebt: "longTermDebt",
  totalDebt: "totalDebt",
  totalLiabilities: "totalLiabilities",
  totalShareholderEquity: "shareholdersEquity",
};

const CASHFLOW_MAP: Record<string, string> = {
  operatingCashflow: "operatingCashFlow",
  capitalExpenditures: "capex",
  acquisitions: "acquisitions",
  dividendPayout: "dividendsPaid",
  paymentsForRepurchaseOfCommonStock: "shareRepurchases",
};

function applyMap(
  report: AnnualReport,
  map: Record<string, string>,
  values: Record<string, number | null>,
  meta: Record<string, "reported">,
): void {
  for (const [source, target] of Object.entries(map)) {
    if (values[target] !== undefined && values[target] !== null) continue;
    const value = avNumber(report[source]);
    if (value !== null) {
      values[target] = value;
      meta[target] = "reported";
    }
  }
}

/**
 * Merge the three Alpha Vantage statement endpoints into annual rows.
 * Free cash flow is derived (OCF − |capex|) and labelled as derived.
 */
export function mergeAlphaVantageStatements(input: {
  income: AnnualReport[];
  balance: AnnualReport[];
  cashflow: AnnualReport[];
  currency: string | null;
}): RawAnnualStatement[] {
  const byYear = new Map<number, RawAnnualStatement>();

  const ensure = (year: number, report: AnnualReport): RawAnnualStatement => {
    const existing = byYear.get(year);
    if (existing) return existing;
    const created: RawAnnualStatement = {
      fiscalYear: year,
      periodEnd: readString(report, "fiscalDateEnding"),
      values: {},
      currency: input.currency,
      units: "units",
      fieldMeta: {},
    };
    byYear.set(year, created);
    return created;
  };

  for (const report of input.income) {
    const year = fiscalYearOf(report);
    if (year === null) continue;
    const row = ensure(year, report);
    row.values.revenue = row.values.revenue ?? null;
    applyMap(report, INCOME_MAP, row.values, row.fieldMeta as Record<string, "reported">);
  }
  for (const report of input.balance) {
    const year = fiscalYearOf(report);
    if (year === null) continue;
    const row = ensure(year, report);
    applyMap(report, BALANCE_MAP, row.values, row.fieldMeta as Record<string, "reported">);
  }
  for (const report of input.cashflow) {
    const year = fiscalYearOf(report);
    if (year === null) continue;
    const row = ensure(year, report);
    applyMap(report, CASHFLOW_MAP, row.values, row.fieldMeta as Record<string, "reported">);

    if (row.values.freeCashFlow === undefined || row.values.freeCashFlow === null) {
      const derived = deriveFreeCashFlow(row.values.operatingCashFlow, row.values.capex);
      if (derived.status === "ok") {
        row.values.freeCashFlow = derived.value;
        row.fieldMeta = { ...row.fieldMeta, freeCashFlow: "derived" };
      }
    }
  }

  return [...byYear.values()]
    .sort((a, b) => b.fiscalYear - a.fiscalYear)
    .slice(0, 5)
    .sort((a, b) => a.fiscalYear - b.fiscalYear);
}

export class AlphaVantageAdapter implements ProviderAdapter {
  readonly id = "alpha_vantage" as const;
  readonly label = "Alpha Vantage";

  private readonly apiKey: string | undefined;

  constructor(apiKey: string | undefined = process.env.ALPHAVANTAGE_API_KEY) {
    this.apiKey = apiKey?.trim() || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private async request(params: Record<string, string>): Promise<unknown> {
    if (!this.apiKey) {
      throw new ProviderError("not_configured", {
        provider: this.id,
        message: "ALPHAVANTAGE_API_KEY is not set.",
      });
    }
    const url = new URL(BASE_URL);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("apikey", this.apiKey);
    const { data } = await fetchJson<unknown>(url.toString(), { provider: this.id });
    return data;
  }

  async search(query: string): Promise<CompanySearchResult[]> {
    const data = await this.request({ function: "SYMBOL_SEARCH", keywords: query });
    return parseSearchResponse(data, query);
  }

  async getProfile(symbol: string): Promise<ProviderProfile> {
    const data = await this.request({ function: "OVERVIEW", symbol });
    return parseOverview(data, symbol).profile;
  }

  async getQuote(symbol: string): Promise<ProviderQuote | null> {
    const overview = await this.request({ function: "OVERVIEW", symbol });
    const { profile, quote: overviewQuote } = parseOverview(overview, symbol);
    const globalQuote = await this.request({ function: "GLOBAL_QUOTE", symbol });
    const quote = parseGlobalQuote(globalQuote, profile.quoteCurrency);
    if (!quote) return overviewQuote;
    return {
      ...overviewQuote,
      price: quote.price,
      quoteDate: quote.quoteDate,
      currency: quote.currency ?? overviewQuote.currency,
    };
  }

  async getStatements(symbol: string): Promise<ProviderStatements> {
    const [incomeData, balanceData, cashflowData] = await Promise.all([
      this.request({ function: "INCOME_STATEMENT", symbol }),
      this.request({ function: "BALANCE_SHEET", symbol }),
      this.request({ function: "CASH_FLOW", symbol }),
    ]);
    const income = annualReports(incomeData, "INCOME_STATEMENT");
    const balance = annualReports(balanceData, "BALANCE_SHEET");
    const cashflow = annualReports(cashflowData, "CASH_FLOW");
    const currency = income.currency ?? balance.currency ?? cashflow.currency;
    return {
      statements: mergeAlphaVantageStatements({
        income: income.reports,
        balance: balance.reports,
        cashflow: cashflow.reports,
        currency,
      }),
      currency,
      source: "Alpha Vantage",
      sourceUrl: "https://www.alphavantage.co/",
    };
  }
}