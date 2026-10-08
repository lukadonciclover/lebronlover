import type { Db } from "@/lib/db/client";
import {
  createAnalysis,
  getAnalysis,
  listAnalyses,
  saveStatements,
  updateAnalysis,
  type AnalysisCreateInput,
  type AnalysisRecord,
  type AnalysisSummary,
  type FinancialRecord,
  type StatementInput,
} from "@/lib/db/repository";
import { computeMetrics, type Metrics } from "@/lib/finance/metrics";
import type { CompanyDraft, NormalizedAnnualStatement } from "@/lib/finance/types";
import type { ManualAnalysisInput } from "@/lib/validation/schemas";

function nowIso(): string {
  return new Date().toISOString();
}

function statementToInput(
  statement: NormalizedAnnualStatement,
  overrides: Partial<StatementInput> = {},
): StatementInput {
  return { ...statement, ...overrides };
}

export function draftToCreateInput(
  draft: CompanyDraft,
  workspaceId: string,
): { analysis: AnalysisCreateInput; statements: StatementInput[] } {
  const latest = draft.statements.at(-1) ?? null;
  const analysis: AnalysisCreateInput = {
    workspaceId,
    isDemo: draft.isDemo ?? false,
    companyName: draft.identity.name,
    ticker: draft.identity.ticker,
    industry: draft.identity.industry ?? null,
    sector: draft.identity.sector ?? null,
    exchange: draft.identity.exchange ?? null,
    country: draft.identity.country ?? null,
    securityType: draft.identity.securityType ?? null,
    description: draft.identity.description ?? null,
    reportingCurrency: draft.market.reportingCurrency,
    quoteCurrency: draft.market.quoteCurrency ?? draft.market.reportingCurrency,
    sharePrice: draft.market.sharePrice ?? null,
    quoteDate: draft.market.quoteDate ?? null,
    sharesOutstanding: draft.market.sharesOutstanding ?? null,
    sharesOutstandingDate: draft.market.sharesOutstandingDate ?? null,
    marketCap: draft.market.marketCap ?? null,
    marketCapDate: draft.market.marketCapDate ?? null,
    // Keep valuation inputs separate from historical balance-sheet values.
    cash: draft.valuation.cash ?? latest?.cashAndEquivalents ?? null,
    cashDate: draft.valuation.cashDate ?? latest?.periodEnd ?? null,
    totalDebt: draft.valuation.totalDebt ?? latest?.totalDebt ?? null,
    debtDate: draft.valuation.debtDate ?? latest?.periodEnd ?? null,
    fxRateToQuote: null,
    source: draft.source,
    sourceUrl: draft.sourceUrl ?? null,
    retrievalDate: draft.retrievalDate,
  };
  const statements = draft.statements.map((statement) => statementToInput(statement));
  return { analysis, statements };
}

export function manualToCreateInput(
  input: ManualAnalysisInput,
  workspaceId: string,
): { analysis: AnalysisCreateInput; statements: StatementInput[] } {
  const analysis: AnalysisCreateInput = {
    workspaceId,
    isDemo: false,
    companyName: input.companyName,
    ticker: input.ticker,
    industry: input.industry ?? null,
    sector: input.sector ?? null,
    exchange: input.exchange ?? null,
    country: input.country ?? null,
    securityType: input.securityType ?? null,
    description: input.description ?? null,
    reportingCurrency: input.reportingCurrency,
    quoteCurrency: input.quoteCurrency ?? input.reportingCurrency,
    sharePrice: input.sharePrice ?? null,
    quoteDate: input.quoteDate ?? null,
    sharesOutstanding: input.sharesOutstanding ?? null,
    sharesOutstandingDate: input.sharesOutstandingDate ?? null,
    marketCap: input.marketCap ?? null,
    marketCapDate: input.marketCapDate ?? null,
    cash: input.cash ?? null,
    cashDate: input.cashDate ?? null,
    totalDebt: input.totalDebt ?? null,
    debtDate: input.debtDate ?? null,
    fxRateToQuote: input.fxRateToQuote ?? null,
    source: "Manual entry",
    sourceUrl: null,
    retrievalDate: nowIso(),
  };
  const statements = input.years.map((year) => ({
    ...year,
    source: "Manual entry",
    retrievalDate: nowIso(),
    originalCurrency: input.reportingCurrency,
    originalUnits: "millions" as const,
    manual: true,
    fieldMeta: Object.fromEntries(
      Object.keys(year)
        .filter((key) => !["fiscalYear", "periodStart", "periodEnd", "filingDate", "source", "sourceUrl", "retrievalDate", "originalCurrency", "originalUnits", "manual", "fieldMeta"].includes(key))
        .map((key) => [key, "manual" as const]),
    ),
  }));
  return { analysis, statements };
}

/**
 * Build a create payload from an import-review or manual form submission.
 * Import submissions keep their per-statement source metadata; manual
 * submissions are labelled as manually entered.
 */
export function formToCreateInput(
  input: ManualAnalysisInput,
  workspaceId: string,
  options: { origin: "manual" | "import"; isDemo?: boolean },
): { analysis: AnalysisCreateInput; statements: StatementInput[] } {
  if (options.origin === "manual") return manualToCreateInput(input, workspaceId);

  const timestamp = nowIso();
  const source = input.source?.trim() || "Imported data";
  const analysis: AnalysisCreateInput = {
    workspaceId,
    isDemo: options.isDemo ?? false,
    companyName: input.companyName,
    ticker: input.ticker,
    industry: input.industry ?? null,
    sector: input.sector ?? null,
    exchange: input.exchange ?? null,
    country: input.country ?? null,
    securityType: input.securityType ?? null,
    description: input.description ?? null,
    reportingCurrency: input.reportingCurrency,
    quoteCurrency: input.quoteCurrency ?? input.reportingCurrency,
    sharePrice: input.sharePrice ?? null,
    quoteDate: input.quoteDate ?? null,
    sharesOutstanding: input.sharesOutstanding ?? null,
    sharesOutstandingDate: input.sharesOutstandingDate ?? null,
    marketCap: input.marketCap ?? null,
    marketCapDate: input.marketCapDate ?? null,
    cash: input.cash ?? null,
    cashDate: input.cashDate ?? null,
    totalDebt: input.totalDebt ?? null,
    debtDate: input.debtDate ?? null,
    fxRateToQuote: input.fxRateToQuote ?? null,
    source,
    sourceUrl: input.sourceUrl ?? null,
    retrievalDate: input.retrievalDate ?? timestamp,
  };
  const statements: StatementInput[] = input.years.map((year) => ({
    ...year,
    source: year.source ?? source,
    retrievalDate: year.retrievalDate ?? timestamp,
    originalCurrency: year.originalCurrency ?? input.reportingCurrency,
    originalUnits: year.originalUnits ?? "millions",
    manual: year.manual ?? false,
  }));
  return { analysis, statements };
}

export async function createAnalysisFromDraft(
  db: Db,
  draft: CompanyDraft,
  workspaceId: string,
): Promise<AnalysisRecord> {
  const { analysis, statements } = draftToCreateInput(draft, workspaceId);
  return createAnalysis(db, analysis, statements);
}

export async function createManualAnalysis(
  db: Db,
  input: ManualAnalysisInput,
  workspaceId: string,
): Promise<AnalysisRecord> {
  const { analysis, statements } = manualToCreateInput(input, workspaceId);
  return createAnalysis(db, analysis, statements);
}

export type UpdateDataInput = {
  fields?: Partial<AnalysisRecord>;
  statements?: StatementInput[];
  removedYears?: number[];
  /** Import review replaces the whole statement set. */
  replaceStatements?: boolean;
};

/**
 * Persist an edit. Only fields present on the payload are written, so an
 * untouched value is never overwritten with null. Statements follow the same
 * merge semantics unless `replaceStatements` is set.
 */
export async function updateAnalysisData(
  db: Db,
  analysisId: string,
  workspaceId: string,
  input: UpdateDataInput,
): Promise<{ analysis: AnalysisRecord; statements: FinancialRecord[] } | null> {
  const existing = await getAnalysis(db, analysisId);
  if (!existing) return null;
  if (existing.analysis.workspaceId !== workspaceId && !existing.analysis.isDemo) return null;

  const fields = input.fields ?? {};
  const updated = await updateAnalysis(db, analysisId, fields);
  if (!updated) return null;

  let statements = existing.statements;
  if (input.statements) {
    statements = await saveStatements(db, analysisId, input.statements, {
      removeMissing: input.replaceStatements ?? false,
      removedYears: input.removedYears,
    });
  }

  return { analysis: updated, statements };
}

export function statementsToMetricsInput(
  analysis: AnalysisRecord,
  statements: readonly FinancialRecord[],
  targetPrice?: number | null,
): Parameters<typeof computeMetrics>[0] {
  return {
    sharePrice: analysis.sharePrice,
    sharesOutstanding: analysis.sharesOutstanding,
    marketCap: analysis.marketCap,
    cash: analysis.cash,
    totalDebt: analysis.totalDebt,
    reportingCurrency: analysis.reportingCurrency,
    quoteCurrency: analysis.quoteCurrency,
    fxRateToQuote: analysis.fxRateToQuote,
    targetPrice: targetPrice ?? null,
    statements: statements.map((statement) => ({
      fiscalYear: statement.fiscalYear,
      revenue: statement.revenue,
      grossProfit: statement.grossProfit,
      ebitda: statement.ebitda,
      depreciationAmortisation: statement.depreciationAmortisation,
      operatingIncome: statement.operatingIncome,
      netIncome: statement.netIncome,
      freeCashFlow: statement.freeCashFlow,
      operatingCashFlow: statement.operatingCashFlow,
      capex: statement.capex,
      shareholdersEquity: statement.shareholdersEquity,
    })),
  };
}

export function computeAnalysisMetrics(
  analysis: AnalysisRecord,
  statements: readonly FinancialRecord[],
  targetPrice?: number | null,
): Metrics {
  return computeMetrics(statementsToMetricsInput(analysis, statements, targetPrice));
}

export type DashboardSummary = {
  coverages: AnalysisSummary[];
  totalsByCurrency: { currency: string; count: number; marketCap: number }[];
  recommendationCounts: { buy: number; hold: number; sell: number; unrated: number };
};

export async function getDashboardData(db: Db, workspaceId: string): Promise<DashboardSummary> {
  const coverages = await listAnalyses(db, workspaceId);

  const counts = { buy: 0, hold: 0, sell: 0, unrated: 0 };
  const byCurrency = new Map<string, { count: number; marketCap: number }>();

  for (const summary of coverages) {
    if (summary.recommendation === "Buy") counts.buy += 1;
    else if (summary.recommendation === "Hold") counts.hold += 1;
    else if (summary.recommendation === "Sell") counts.sell += 1;
    else counts.unrated += 1;

    const metrics = computeAnalysisMetrics(
      summary.analysis,
      summary.latestStatement ? [summary.latestStatement] : [],
      summary.targetPrice,
    );
    const currency = summary.analysis.quoteCurrency ?? summary.analysis.reportingCurrency;
    const entry = byCurrency.get(currency) ?? { count: 0, marketCap: 0 };
    entry.count += 1;
    if (metrics.marketCap.status === "ok") entry.marketCap += metrics.marketCap.value;
    byCurrency.set(currency, entry);
  }

  return {
    coverages,
    totalsByCurrency: [...byCurrency.entries()]
      .map(([currency, value]) => ({ currency, ...value }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    recommendationCounts: counts,
  };
}