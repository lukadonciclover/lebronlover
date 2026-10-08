import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { BALANCE_FIELDS, CASHFLOW_FIELDS, INCOME_FIELDS } from "@/lib/finance/types";

const moneyColumns = Object.fromEntries(
  [...INCOME_FIELDS, ...BALANCE_FIELDS, ...CASHFLOW_FIELDS].map((field) => [
    field,
    real(field),
  ]),
) as Record<string, ReturnType<typeof real>>;

export const analyses = sqliteTable("analyses", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),

  companyName: text("company_name").notNull(),
  ticker: text("ticker").notNull(),
  industry: text("industry"),
  sector: text("sector"),
  exchange: text("exchange"),
  country: text("country"),
  securityType: text("security_type"),
  description: text("description"),

  reportingCurrency: text("reporting_currency").notNull(),
  quoteCurrency: text("quote_currency"),

  sharePrice: real("share_price"),
  quoteDate: text("quote_date"),
  sharesOutstanding: real("shares_outstanding"),
  sharesOutstandingDate: text("shares_outstanding_date"),
  marketCap: real("market_cap"),
  marketCapDate: text("market_cap_date"),

  cash: real("cash"),
  cashDate: text("cash_date"),
  totalDebt: real("total_debt"),
  debtDate: text("debt_date"),

  /** Explicit quote-currency units per reporting-currency unit. Never assumed. */
  fxRateToQuote: real("fx_rate_to_quote"),

  source: text("source"),
  sourceUrl: text("source_url"),
  retrievalDate: text("retrieval_date"),

  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const annualFinancials = sqliteTable("annual_financials", {
  id: text("id").primaryKey(),
  analysisId: text("analysis_id").notNull(),
  fiscalYear: integer("fiscal_year").notNull(),
  periodStart: text("period_start"),
  periodEnd: text("period_end"),
  filingDate: text("filing_date"),

  source: text("source"),
  sourceUrl: text("source_url"),
  retrievalDate: text("retrieval_date"),
  originalCurrency: text("original_currency"),
  originalUnits: text("original_units"),
  manual: integer("manual", { mode: "boolean" }).notNull().default(false),
  fieldMeta: text("field_meta"),

  ...moneyColumns,
});

export const theses = sqliteTable("theses", {
  analysisId: text("analysis_id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  recommendation: text("recommendation"),
  targetPrice: real("target_price"),
  summary: text("summary"),
  catalysts: text("catalysts"),
  risks: text("risks"),
  updatedAt: text("updated_at").notNull(),
});

export const cacheEntries = sqliteTable("cache_entries", {
  key: text("key").primaryKey(),
  provider: text("provider").notNull(),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
  isError: integer("is_error", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export type AnalysisRow = typeof analyses.$inferSelect;
export type AnnualFinancialRow = typeof annualFinancials.$inferSelect;
export type ThesisRow = typeof theses.$inferSelect;
export type CacheEntryRow = typeof cacheEntries.$inferSelect;