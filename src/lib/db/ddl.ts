import { BALANCE_FIELDS, CASHFLOW_FIELDS, INCOME_FIELDS } from "@/lib/finance/types";

const FINANCIAL_COLUMNS = [...INCOME_FIELDS, ...BALANCE_FIELDS, ...CASHFLOW_FIELDS];

const financialColumnSql = FINANCIAL_COLUMNS.map((field) => `  ${field} REAL`).join(",\n");

/**
 * Idempotent DDL used to create the schema on first use and in tests.
 * The same statements are mirrored in drizzle/0000_init.sql for deployments
 * that prefer to migrate explicitly.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS analyses (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  company_name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  industry TEXT,
  sector TEXT,
  exchange TEXT,
  country TEXT,
  security_type TEXT,
  description TEXT,
  reporting_currency TEXT NOT NULL,
  quote_currency TEXT,
  share_price REAL,
  quote_date TEXT,
  shares_outstanding REAL,
  shares_outstanding_date TEXT,
  market_cap REAL,
  market_cap_date TEXT,
  cash REAL,
  cash_date TEXT,
  total_debt REAL,
  debt_date TEXT,
  fx_rate_to_quote REAL,
  source TEXT,
  source_url TEXT,
  retrieval_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_analyses_workspace ON analyses (workspace_id)`,
  `CREATE TABLE IF NOT EXISTS annual_financials (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  period_start TEXT,
  period_end TEXT,
  filing_date TEXT,
  source TEXT,
  source_url TEXT,
  retrieval_date TEXT,
  original_currency TEXT,
  original_units TEXT,
  manual INTEGER NOT NULL DEFAULT 0,
  field_meta TEXT,
${financialColumnSql}
)`,
  `CREATE INDEX IF NOT EXISTS idx_annual_analysis ON annual_financials (analysis_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_annual_unique ON annual_financials (analysis_id, fiscal_year)`,
  `CREATE TABLE IF NOT EXISTS theses (
  analysis_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  recommendation TEXT,
  target_price REAL,
  summary TEXT,
  catalysts TEXT,
  risks TEXT,
  updated_at TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS cache_entries (
  key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  is_error INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_cache_expiry ON cache_entries (expires_at)`,
];