import type { FinancialsFormValue, YearState } from "@/components/financials-form";
import type { AnalysisRecord, FinancialRecord } from "@/lib/db/repository";
import type { CompanyDraft, NormalizedAnnualStatement } from "@/lib/finance/types";
import { ALL_YEAR_FIELDS } from "@/lib/form-fields";

function num(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "" : String(value);
}

function statementToYear(statement: NormalizedAnnualStatement): YearState {
  const year: YearState = { fiscalYear: String(statement.fiscalYear) };
  for (const def of ALL_YEAR_FIELDS) {
    const value = (statement as unknown as Record<string, number | null>)[def.key];
    year[def.key] = num(value);
  }
  year.periodStart = statement.periodStart ?? undefined;
  year.periodEnd = statement.periodEnd ?? undefined;
  year.filingDate = statement.filingDate ?? undefined;
  year.source = statement.source ?? undefined;
  year.sourceUrl = statement.sourceUrl ?? undefined;
  year.retrievalDate = statement.retrievalDate ?? undefined;
  year.originalCurrency = statement.originalCurrency ?? undefined;
  year.originalUnits = statement.originalUnits ?? undefined;
  year.manual = statement.manual ?? false;
  year.fieldMeta = statement.fieldMeta ?? {};
  return year;
}

export function draftToFormValue(draft: CompanyDraft): FinancialsFormValue {
  return {
    core: {
      companyName: draft.identity.name,
      ticker: draft.identity.ticker,
      industry: draft.identity.industry ?? "",
      sector: draft.identity.sector ?? "",
      exchange: draft.identity.exchange ?? "",
      country: draft.identity.country ?? "",
      securityType: draft.identity.securityType ?? "",
      description: draft.identity.description ?? "",
      reportingCurrency: draft.market.reportingCurrency,
      quoteCurrency: draft.market.quoteCurrency ?? "",
      sharePrice: num(draft.market.sharePrice),
      quoteDate: draft.market.quoteDate ?? "",
      sharesOutstanding: num(draft.market.sharesOutstanding),
      sharesOutstandingDate: draft.market.sharesOutstandingDate ?? "",
      marketCap: num(draft.market.marketCap),
      marketCapDate: draft.market.marketCapDate ?? "",
      cash: num(draft.valuation.cash),
      cashDate: draft.valuation.cashDate ?? "",
      totalDebt: num(draft.valuation.totalDebt),
      debtDate: draft.valuation.debtDate ?? "",
      fxRateToQuote: "",
      source: draft.source,
      sourceUrl: draft.sourceUrl ?? "",
      retrievalDate: draft.retrievalDate,
    },
    years: draft.statements.map(statementToYear),
    meta: {
      source: draft.source,
      sourceUrl: draft.sourceUrl ?? null,
      retrievalDate: draft.retrievalDate,
      isDemo: draft.isDemo,
      warnings: draft.warnings,
    },
  };
}

export function recordToFormValue(
  analysis: AnalysisRecord,
  statements: readonly FinancialRecord[],
): FinancialsFormValue {
  return {
    core: {
      companyName: analysis.companyName,
      ticker: analysis.ticker,
      industry: analysis.industry ?? "",
      sector: analysis.sector ?? "",
      exchange: analysis.exchange ?? "",
      country: analysis.country ?? "",
      securityType: analysis.securityType ?? "",
      description: analysis.description ?? "",
      reportingCurrency: analysis.reportingCurrency,
      quoteCurrency: analysis.quoteCurrency ?? "",
      sharePrice: num(analysis.sharePrice),
      quoteDate: analysis.quoteDate ?? "",
      sharesOutstanding: num(analysis.sharesOutstanding),
      sharesOutstandingDate: analysis.sharesOutstandingDate ?? "",
      marketCap: num(analysis.marketCap),
      marketCapDate: analysis.marketCapDate ?? "",
      cash: num(analysis.cash),
      cashDate: analysis.cashDate ?? "",
      totalDebt: num(analysis.totalDebt),
      debtDate: analysis.debtDate ?? "",
      fxRateToQuote: num(analysis.fxRateToQuote),
      source: analysis.source ?? "",
      sourceUrl: analysis.sourceUrl ?? "",
      retrievalDate: analysis.retrievalDate ?? "",
    },
    years: statements.map(statementToYear),
  };
}

export function manualDefaults(prefill?: {
  companyName?: string;
  ticker?: string;
}): FinancialsFormValue {
  const currentYear = new Date().getFullYear();
  const years: YearState[] = [currentYear - 2, currentYear - 1, currentYear].map((year) => ({
    fiscalYear: String(year),
  }));
  return {
    core: {
      companyName: prefill?.companyName ?? "",
      ticker: prefill?.ticker ?? "",
      reportingCurrency: "USD",
    },
    years,
  };
}