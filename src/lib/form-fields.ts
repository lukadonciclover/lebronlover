export type FieldKind = "number" | "date" | "text";

export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  unit?: string;
  help?: string;
};

export const CORE_COMPANY_FIELDS: FieldDef[] = [
  { key: "companyName", label: "Legal company name", kind: "text" },
  { key: "ticker", label: "Ticker", kind: "text" },
  { key: "industry", label: "Industry", kind: "text" },
  { key: "exchange", label: "Exchange", kind: "text" },
  { key: "country", label: "Country or region", kind: "text" },
];

export const MARKET_FIELDS: FieldDef[] = [
  { key: "sharePrice", label: "Share price", kind: "number", unit: "quote currency" },
  { key: "quoteDate", label: "Quote date", kind: "date" },
  {
    key: "sharesOutstanding",
    label: "Shares outstanding",
    kind: "number",
    unit: "millions",
    help: "Ordinary shares outstanding. Not diluted unless the source explicitly says so.",
  },
  { key: "sharesOutstandingDate", label: "Shares outstanding as of", kind: "date" },
  { key: "marketCap", label: "Market capitalisation", kind: "number", unit: "millions" },
  { key: "marketCapDate", label: "Market cap as of", kind: "date" },
];

export const VALUATION_FIELDS: FieldDef[] = [
  {
    key: "cash",
    label: "Cash and equivalents",
    kind: "number",
    unit: "millions",
    help: "Used for the valuation snapshot. Keep separate from historical balance-sheet cash when dates differ.",
  },
  { key: "cashDate", label: "Cash as of", kind: "date" },
  { key: "totalDebt", label: "Total debt", kind: "number", unit: "millions" },
  { key: "debtDate", label: "Debt as of", kind: "date" },
  {
    key: "fxRateToQuote",
    label: "FX rate (reporting → quote)",
    kind: "number",
    unit: "quote units per reporting unit",
    help: "Optional. Only needed when reporting and quote currencies differ. Never assumed.",
  },
];

export const CORE_YEAR_FIELDS: FieldDef[] = [
  { key: "revenue", label: "Revenue", kind: "number", unit: "millions" },
  { key: "ebitda", label: "EBITDA", kind: "number", unit: "millions" },
  { key: "operatingIncome", label: "Operating income (EBIT)", kind: "number", unit: "millions" },
  { key: "netIncome", label: "Net income", kind: "number", unit: "millions" },
  { key: "freeCashFlow", label: "Free cash flow", kind: "number", unit: "millions" },
];

export const OPTIONAL_YEAR_GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Income statement",
    fields: [
      { key: "costOfRevenue", label: "Cost of revenue", kind: "number", unit: "millions" },
      { key: "grossProfit", label: "Gross profit", kind: "number", unit: "millions" },
      {
        key: "depreciationAmortisation",
        label: "Depreciation & amortisation",
        kind: "number",
        unit: "millions",
        help: "Used only to derive EBITDA when it is not reported.",
      },
      { key: "eps", label: "Earnings per share", kind: "number", unit: "per share" },
    ],
  },
  {
    title: "Balance sheet",
    fields: [
      { key: "cashAndEquivalents", label: "Cash and equivalents", kind: "number", unit: "millions" },
      { key: "shortTermInvestments", label: "Short-term investments", kind: "number", unit: "millions" },
      { key: "totalAssets", label: "Total assets", kind: "number", unit: "millions" },
      { key: "currentAssets", label: "Current assets", kind: "number", unit: "millions" },
      { key: "currentLiabilities", label: "Current liabilities", kind: "number", unit: "millions" },
      { key: "shortTermDebt", label: "Short-term debt", kind: "number", unit: "millions" },
      { key: "longTermDebt", label: "Long-term debt", kind: "number", unit: "millions" },
      { key: "totalDebt", label: "Total debt", kind: "number", unit: "millions" },
      { key: "totalLiabilities", label: "Total liabilities", kind: "number", unit: "millions" },
      { key: "shareholdersEquity", label: "Shareholders' equity", kind: "number", unit: "millions" },
    ],
  },
  {
    title: "Cash flow",
    fields: [
      { key: "operatingCashFlow", label: "Operating cash flow", kind: "number", unit: "millions" },
      {
        key: "capex",
        label: "Capital expenditure",
        kind: "number",
        unit: "millions",
        help: "Sign is ignored when deriving free cash flow.",
      },
      { key: "acquisitions", label: "Acquisitions", kind: "number", unit: "millions" },
      { key: "dividendsPaid", label: "Dividends paid", kind: "number", unit: "millions" },
      { key: "shareRepurchases", label: "Share repurchases", kind: "number", unit: "millions" },
    ],
  },
];

export const ALL_YEAR_FIELDS: FieldDef[] = [
  ...CORE_YEAR_FIELDS,
  ...OPTIONAL_YEAR_GROUPS.flatMap((group) => group.fields),
];

export const YEAR_METADATA_KEYS = new Set([
  "fiscalYear",
  "periodStart",
  "periodEnd",
  "filingDate",
  "source",
  "sourceUrl",
  "retrievalDate",
  "originalCurrency",
  "originalUnits",
  "manual",
  "fieldMeta",
]);