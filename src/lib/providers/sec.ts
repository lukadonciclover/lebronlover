import { z } from "zod";
import { ProviderError } from "@/lib/errors";
import { fetchJson } from "@/lib/providers/http";
import type {
  ProviderAdapter,
  ProviderProfile,
  ProviderQuote,
  ProviderStatements,
} from "@/lib/providers/types";
import type { CompanySearchResult, RawAnnualStatement } from "@/lib/finance/types";
import { deriveEbitda, deriveFreeCashFlow } from "@/lib/finance/calculations";

const TICKER_URL = "https://www.sec.gov/files/company_tickers_exchange.json";
const FACTS_URL = (cik: string) =>
  `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik.padStart(10, "0")}.json`;

export function secUserAgent(): string {
  return (
    process.env.SEC_USER_AGENT?.trim() ||
    "Investment Pitch Copilot (contact: set SEC_USER_AGENT to your email)"
  );
}

const SEC_HEADERS = { "User-Agent": secUserAgent(), "Accept-Encoding": "gzip, deflate" };

const tickerSchema = z.object({
  fields: z.array(z.string()),
  data: z.array(z.array(z.union([z.string(), z.number()]))),
});

export type SecTickerRow = {
  cik: string;
  name: string;
  ticker: string;
  exchange: string | null;
};

export function parseTickerFile(payload: unknown): SecTickerRow[] {
  const parsed = tickerSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ProviderError("malformed_response", {
      provider: "sec",
      message: "Unexpected SEC ticker file shape.",
    });
  }
  const index = (name: string) => parsed.data.fields.indexOf(name);
  const cikIndex = index("cik");
  const nameIndex = index("name");
  const tickerIndex = index("ticker");
  const exchangeIndex = index("exchange");
  if (cikIndex === -1 || tickerIndex === -1) {
    throw new ProviderError("malformed_response", {
      provider: "sec",
      message: "SEC ticker file is missing cik/ticker fields.",
    });
  }
  return parsed.data.data
    .map((row) => ({
      cik: String(row[cikIndex]),
      name: nameIndex === -1 ? "" : String(row[nameIndex]),
      ticker: String(row[tickerIndex]),
      exchange: exchangeIndex === -1 ? null : String(row[exchangeIndex] || "") || null,
    }))
    .filter((row) => row.ticker);
}

export function searchTickers(rows: SecTickerRow[], query: string): CompanySearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: CompanySearchResult[] = [];
  for (const row of rows) {
    const ticker = row.ticker.toLowerCase();
    const name = row.name.toLowerCase();
    let rank: number | null = null;
    if (ticker === q) rank = 0;
    else if (ticker.startsWith(q)) rank = 10;
    else if (name.startsWith(q)) rank = 20;
    else if (name.includes(q)) rank = 30;
    if (rank === null) continue;
    scored.push({
      provider: "sec",
      symbol: row.ticker,
      name: row.name || row.ticker,
      exchange: row.exchange,
      country: null,
      region: null,
      securityType: null,
      currency: null,
      dataSource: "SEC EDGAR",
      rank,
    });
  }
  return scored.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).slice(0, 25);
}

export type SecFactRecord = {
  start?: string;
  end?: string;
  val: number;
  form?: string;
  filed?: string;
  frame?: string;
  fy?: number;
  fp?: string;
};

export type SecFacts = Record<string, Record<string, { units?: Record<string, SecFactRecord[]> }>>;

const ANNUAL_FORMS = ["10-K", "20-F", "40-F"];

function isAnnualForm(form: string | undefined): boolean {
  if (!form) return false;
  return ANNUAL_FORMS.some((prefix) => form === prefix || form === `${prefix}/A`);
}

function daysBetween(start: string, end: string): number {
  return (Date.parse(end) - Date.parse(start)) / 86_400_000;
}

export type AnnualFact = {
  value: number;
  start: string | null;
  end: string;
  filed: string | null;
  form: string | null;
  concept: string;
  fiscalYear: number;
};

/**
 * Extract one annual value per fiscal year for a list of candidate concepts.
 *
 * - Only annual forms (10-K/20-F/40-F and their amendments) are considered.
 * - Flow concepts require a ~12 month duration so a quarterly or year-to-date
 *   figure is never mistaken for a full year.
 * - When a period has been restated, the most recently filed value wins.
 */
export function selectAnnualFacts(
  facts: SecFacts,
  concepts: readonly string[],
  options: { unit: "monetary" | "perShare" | "shares"; requireDuration?: boolean } = {
    unit: "monetary",
    requireDuration: true,
  },
): Map<number, AnnualFact> {
  const result = new Map<number, AnnualFact>();
  for (const concept of concepts) {
    const conceptFacts = facts["us-gaap"]?.[concept];
    if (!conceptFacts?.units) continue;
    for (const [unitName, records] of Object.entries(conceptFacts.units)) {
      const unitMatches =
        options.unit === "monetary"
          ? /^[A-Z]{3}$/.test(unitName) && unitName !== "USD/shares"
          : options.unit === "perShare"
            ? unitName.includes("/shares")
            : unitName === "shares" || unitName === "shares/shares";
      if (!unitMatches) continue;
      for (const record of records ?? []) {
        if (!record.end || !Number.isFinite(record.val)) continue;
        if (!isAnnualForm(record.form)) continue;
        if (options.requireDuration) {
          if (!record.start) continue;
          const days = daysBetween(record.start, record.end);
          if (days < 300 || days > 400) continue;
        }
        const fiscalYear = Number(record.end.slice(0, 4));
        if (!Number.isFinite(fiscalYear)) continue;
        const existing = result.get(fiscalYear);
        const filed = record.filed ?? "";
        if (existing && existing.filed && filed && existing.filed >= filed) continue;
        if (existing && !filed) continue;
        result.set(fiscalYear, {
          value: record.val,
          start: record.start ?? null,
          end: record.end,
          filed: record.filed ?? null,
          form: record.form ?? null,
          concept,
          fiscalYear,
        });
      }
    }
  }
  return result;
}

function mergeSeries(
  facts: SecFacts,
  mapping: Record<string, readonly string[]>,
  options: { requireDuration: boolean },
): {
  byYear: Map<number, RawAnnualStatement>;
  usedConcepts: Map<string, string>;
} {
  const byYear = new Map<number, RawAnnualStatement>();
  const usedConcepts = new Map<string, string>();
  for (const [target, concepts] of Object.entries(mapping)) {
    const perShare = target === "eps";
    const series = selectAnnualFacts(facts, concepts, {
      unit: perShare ? "perShare" : "monetary",
      requireDuration: options.requireDuration,
    });
    for (const [year, fact] of series) {
      const row =
        byYear.get(year) ??
        ({
          fiscalYear: year,
          periodStart: fact.start,
          periodEnd: fact.end,
          filingDate: fact.filed,
          values: {},
          units: "units",
          fieldMeta: {},
        } satisfies RawAnnualStatement);
      if (row.values[target as keyof typeof row.values] === undefined) {
        (row.values as Record<string, number | null>)[target] = fact.value;
        (row.fieldMeta as Record<string, string>)[target] = "reported";
        usedConcepts.set(`${year}:${target}`, fact.concept);
      }
      byYear.set(year, row);
    }
  }
  return { byYear, usedConcepts };
}

const INCOME_CONCEPTS: Record<string, readonly string[]> = {
  revenue: [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
  ],
  costOfRevenue: ["CostOfRevenue", "CostOfGoodsAndServicesSold"],
  grossProfit: ["GrossProfit"],
  operatingIncome: ["OperatingIncomeLoss"],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  eps: ["EarningsPerShareDiluted", "EarningsPerShareBasic"],
  depreciationAmortisation: [
    "DepreciationDepletionAndAmortization",
    "DepreciationAndAmortization",
    "DepreciationAmortizationAndAccretionNet",
  ],
};

const BALANCE_CONCEPTS: Record<string, readonly string[]> = {
  cashAndEquivalents: [
    "CashAndCashEquivalentsAtCarryingValue",
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
  ],
  shortTermInvestments: ["ShortTermInvestments", "AvailableForSaleSecuritiesDebtSecuritiesCurrent"],
  totalAssets: ["Assets"],
  currentAssets: ["AssetsCurrent"],
  currentLiabilities: ["LiabilitiesCurrent"],
  shortTermDebt: ["LongTermDebtCurrent", "DebtCurrent", "ShortTermBorrowings"],
  longTermDebt: ["LongTermDebtNoncurrent", "LongTermDebt"],
  totalLiabilities: ["Liabilities"],
  shareholdersEquity: [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  ],
};

const CASHFLOW_CONCEPTS: Record<string, readonly string[]> = {
  operatingCashFlow: [
    "NetCashProvidedByUsedInOperatingActivities",
    "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
  ],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
  acquisitions: ["PaymentsToAcquireBusinessesNetOfCashAcquired"],
  dividendsPaid: ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"],
  shareRepurchases: ["PaymentsForRepurchaseOfCommonStock"],
};

export function statementCurrency(facts: SecFacts): string | null {
  const revenue = facts["us-gaap"]?.["Revenues"]?.units ?? {};
  for (const unit of Object.keys(revenue)) {
    if (/^[A-Z]{3}$/.test(unit)) return unit;
  }
  for (const concept of Object.values(facts["us-gaap"] ?? {})) {
    for (const unit of Object.keys(concept.units ?? {})) {
      if (/^[A-Z]{3}$/.test(unit) && unit !== "USD/shares") return unit;
    }
  }
  return "USD";
}

/**
 * Map SEC Company Facts into normalised annual rows.
 * EBITDA and total debt are derived only when compatible inputs exist.
 */
export function mapSecFactsToStatements(facts: SecFacts): RawAnnualStatement[] {
  const income = mergeSeries(facts, INCOME_CONCEPTS, { requireDuration: true });
  const balance = mergeSeries(facts, BALANCE_CONCEPTS, { requireDuration: false });
  const cashflow = mergeSeries(facts, CASHFLOW_CONCEPTS, { requireDuration: true });
  const currency = statementCurrency(facts);

  const years = new Set<number>([
    ...income.byYear.keys(),
    ...balance.byYear.keys(),
    ...cashflow.byYear.keys(),
  ]);

  const rows: RawAnnualStatement[] = [];
  for (const year of [...years].sort((a, b) => b - a)) {
    const incomeRow = income.byYear.get(year);
    const balanceRow = balance.byYear.get(year);
    const cashflowRow = cashflow.byYear.get(year);
    const values: RawAnnualStatement["values"] = {
      ...(incomeRow?.values ?? {}),
      ...(balanceRow?.values ?? {}),
      ...(cashflowRow?.values ?? {}),
    };
    const fieldMeta = {
      ...(incomeRow?.fieldMeta ?? {}),
      ...(balanceRow?.fieldMeta ?? {}),
      ...(cashflowRow?.fieldMeta ?? {}),
    };

    // Derive total debt only when both components are present.
    if (!values.totalDebt && values.shortTermDebt != null && values.longTermDebt != null) {
      values.totalDebt = values.shortTermDebt + values.longTermDebt;
      fieldMeta.totalDebt = "derived";
    }
    // Derive EBITDA only from compatible operating income + D&A.
    if (values.ebitda == null) {
      const derived = deriveEbitda(values.operatingIncome, values.depreciationAmortisation);
      if (derived.status === "ok") {
        values.ebitda = derived.value;
        fieldMeta.ebitda = "derived";
      }
    }
    if (values.freeCashFlow == null) {
      const derived = deriveFreeCashFlow(values.operatingCashFlow, values.capex);
      if (derived.status === "ok") {
        values.freeCashFlow = derived.value;
        fieldMeta.freeCashFlow = "derived";
      }
    }

    const source = incomeRow ?? balanceRow ?? cashflowRow;
    rows.push({
      fiscalYear: year,
      periodStart: source?.periodStart ?? null,
      periodEnd: source?.periodEnd ?? null,
      filingDate: source?.filingDate ?? null,
      values,
      fieldMeta,
      currency,
      units: "units",
    });
  }

  return rows.slice(0, 5).sort((a, b) => a.fiscalYear - b.fiscalYear);
}

export function latestSharesOutstanding(facts: SecFacts): number | null {
  const concept = facts["dei"]?.["EntityCommonStockSharesOutstanding"];
  const records = concept?.units?.["shares"] ?? [];
  let best: SecFactRecord | null = null;
  for (const record of records) {
    if (!Number.isFinite(record.val) || !record.end) continue;
    if (!best || (record.end ?? "") > (best.end ?? "")) best = record;
  }
  return best ? best.val : null;
}

export class SecAdapter implements ProviderAdapter {
  readonly id = "sec" as const;
  readonly label = "SEC EDGAR";

  isConfigured(): boolean {
    // SEC EDGAR needs no API key; it only requires a descriptive user agent.
    return true;
  }

  private async getTickerRows(): Promise<SecTickerRow[]> {
    const { data } = await fetchJson<unknown>(TICKER_URL, {
      provider: this.id,
      headers: SEC_HEADERS,
    });
    return parseTickerFile(data);
  }

  private async getFacts(cik: string): Promise<SecFacts> {
    const { data } = await fetchJson<unknown>(FACTS_URL(cik), {
      provider: this.id,
      headers: SEC_HEADERS,
      retries: 1,
    });
    if (!data || typeof data !== "object" || !("facts" in data)) {
      throw new ProviderError("malformed_response", {
        provider: this.id,
        message: "SEC company facts response was missing the facts object.",
      });
    }
    return (data as { facts: SecFacts }).facts;
  }

  async search(query: string): Promise<CompanySearchResult[]> {
    return searchTickers(await this.getTickerRows(), query);
  }

  async resolveCik(symbol: string): Promise<{ cik: string; row: SecTickerRow }> {
    const rows = await this.getTickerRows();
    const upper = symbol.trim().toUpperCase();
    const row = rows.find((candidate) => candidate.ticker.toUpperCase() === upper);
    if (!row) {
      throw new ProviderError("no_data", {
        provider: this.id,
        message: `No SEC registrant found for ${symbol}.`,
      });
    }
    return { cik: row.cik, row };
  }

  async getProfile(symbol: string): Promise<ProviderProfile> {
    const { cik, row } = await this.resolveCik(symbol);
    const facts = await this.getFacts(cik);
    const entityName = (facts as unknown as { entityName?: string }).entityName;
    return {
      identity: {
        name: entityName || row.name || symbol,
        ticker: row.ticker || symbol,
        exchange: row.exchange,
        country: null,
        sector: null,
        industry: null,
        description: null,
        securityType: null,
      },
      reportingCurrency: statementCurrency(facts),
      quoteCurrency: null,
      source: "SEC EDGAR",
      sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`,
      externalId: cik,
    };
  }

  async getQuote(symbol: string): Promise<ProviderQuote | null> {
    const { cik } = await this.resolveCik(symbol);
    const facts = await this.getFacts(cik);
    const shares = latestSharesOutstanding(facts);
    // SEC does not provide share prices; the user supplies the price manually.
    return {
      price: null,
      quoteDate: null,
      currency: null,
      sharesOutstanding: shares,
      sharesOutstandingDate: null,
      marketCap: null,
      marketCapDate: null,
      source: "SEC EDGAR",
    };
  }

  async getStatements(symbol: string): Promise<ProviderStatements> {
    const { cik, row } = await this.resolveCik(symbol);
    const facts = await this.getFacts(cik);
    const statements = mapSecFactsToStatements(facts);
    if (statements.length === 0) {
      throw new ProviderError("no_data", {
        provider: this.id,
        message: `No annual XBRL facts found for ${symbol}.`,
      });
    }
    return {
      statements,
      currency: statementCurrency(facts),
      source: "SEC EDGAR",
      sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${row.cik}`,
    };
  }
}