import type { CurrencyCode, ProviderId, SecurityType, UnitScale, ValueOrigin } from "@/lib/constants";

/** Canonical money fields on an annual statement (values in millions unless noted). */
export const INCOME_FIELDS = [
  "revenue",
  "costOfRevenue",
  "grossProfit",
  "ebitda",
  "depreciationAmortisation",
  "operatingIncome",
  "netIncome",
  "eps",
] as const;

export const BALANCE_FIELDS = [
  "cashAndEquivalents",
  "shortTermInvestments",
  "totalAssets",
  "currentAssets",
  "currentLiabilities",
  "shortTermDebt",
  "longTermDebt",
  "totalDebt",
  "totalLiabilities",
  "shareholdersEquity",
] as const;

export const CASHFLOW_FIELDS = [
  "operatingCashFlow",
  "capex",
  "freeCashFlow",
  "acquisitions",
  "dividendsPaid",
  "shareRepurchases",
] as const;

export const FINANCIAL_FIELDS = [
  ...INCOME_FIELDS,
  ...BALANCE_FIELDS,
  ...CASHFLOW_FIELDS,
] as const;

export type FinancialField = (typeof FINANCIAL_FIELDS)[number];

export type FinancialValues = {
  [K in FinancialField]: number | null;
};

/** Per-field provenance. Missing keys default to "reported". */
export type FieldMeta = Partial<Record<FinancialField, ValueOrigin>>;

export type NormalizedAnnualStatement = FinancialValues & {
  fiscalYear: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  filingDate?: string | null;
  retrievalDate: string;
  source: string;
  sourceUrl?: string | null;
  originalCurrency?: string | null;
  originalUnits?: UnitScale | null;
  /** True when the row came from a manual workflow. */
  manual?: boolean;
  fieldMeta?: FieldMeta;
};

export type CompanyIdentity = {
  name: string;
  ticker: string;
  exchange?: string | null;
  country?: string | null;
  sector?: string | null;
  industry?: string | null;
  description?: string | null;
  securityType?: SecurityType | null;
};

export type MarketInfo = {
  /** Reporting currency of the financial statements. */
  reportingCurrency: string;
  /** Currency the share price is quoted in. May differ from reporting currency. */
  quoteCurrency: string;
  sharePrice?: number | null;
  quoteDate?: string | null;
  sharesOutstanding?: number | null;
  sharesOutstandingDate?: string | null;
  marketCap?: number | null;
  marketCapDate?: string | null;
};

export type ValuationInputs = {
  /** Cash and equivalents used for the valuation snapshot, in millions of reporting currency. */
  cash?: number | null;
  cashDate?: string | null;
  /** Total debt used for the valuation snapshot, in millions of reporting currency. */
  totalDebt?: number | null;
  debtDate?: string | null;
};

/**
 * A candidate returned from a provider search. Only fields the provider
 * actually supplies are populated; missing values stay null rather than being
 * invented.
 */
export type CompanySearchResult = {
  provider: ProviderId;
  symbol: string;
  name: string;
  exchange?: string | null;
  country?: string | null;
  region?: string | null;
  securityType?: SecurityType | null;
  currency?: string | null;
  dataSource: string;
  /** Lower is better. Exact ticker matches should sort first. */
  rank?: number;
};

export type CompanyDraft = {
  provider: ProviderId;
  identity: CompanyIdentity;
  market: MarketInfo;
  valuation: ValuationInputs;
  statements: NormalizedAnnualStatement[];
  /** Non-fatal problems encountered while assembling the draft. */
  warnings: ProviderWarning[];
  /** Where the data came from. */
  source: string;
  sourceUrl?: string | null;
  retrievalDate: string;
  /** True when the draft is synthetic demo data. */
  isDemo?: boolean;
};

export type ProviderWarning = {
  code: string;
  message: string;
  /** Which part of the import was affected. */
  scope: "profile" | "quote" | "statements" | "general";
};

export type SearchResponse = {
  query: string;
  results: CompanySearchResult[];
  warnings: ProviderWarning[];
  providers: ProviderId[];
};

export type ImportResult =
  | { ok: true; draft: CompanyDraft }
  | {
      ok: false;
      error: { code: string; message: string };
      /** A previously cached draft, if one exists, with its retrieval date. */
      cached?: CompanyDraft;
    };

/** Raw provider statement row before normalisation to millions. */
export type RawAnnualStatement = {
  fiscalYear: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  filingDate?: string | null;
  values: Partial<Record<FinancialField, number | null>>;
  currency?: string | null;
  units?: UnitScale | null;
  fieldMeta?: FieldMeta;
};

export type RawCompanyData = {
  identity: CompanyIdentity;
  market: MarketInfo;
  valuation: ValuationInputs;
  statements: RawAnnualStatement[];
  source: string;
  sourceUrl?: string | null;
};

export type { CurrencyCode, ProviderId, SecurityType, UnitScale, ValueOrigin };