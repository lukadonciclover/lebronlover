import {
  deriveEbitda,
  deriveFreeCashFlow,
  ebitdaMargin,
  enterpriseValue,
  evToEbitda,
  evToRevenue,
  fcfMargin,
  fcfYield,
  fxScale,
  grossMargin,
  impliedUpside,
  marketCap as marketCapFn,
  netDebt as netDebtFn,
  netMargin,
  ok,
  operatingMargin,
  peRatio,
  returnOnEquity,
  revenueCagr,
  revenueGrowth,
  type MetricResult,
} from "@/lib/finance/calculations";
import { hasValue } from "@/lib/finance/normalize";
import type { FinancialValues } from "@/lib/finance/types";

export type MetricsInputStatement = Partial<
  Pick<
    FinancialValues,
    | "revenue"
    | "grossProfit"
    | "ebitda"
    | "depreciationAmortisation"
    | "operatingIncome"
    | "netIncome"
    | "freeCashFlow"
    | "operatingCashFlow"
    | "capex"
    | "shareholdersEquity"
  >
> & { fiscalYear: number };

export type MetricsInput = {
  sharePrice?: number | null;
  sharesOutstanding?: number | null;
  marketCap?: number | null;
  cash?: number | null;
  totalDebt?: number | null;
  reportingCurrency?: string | null;
  quoteCurrency?: string | null;
  /** Explicit quote-currency units per reporting-currency unit. Never assumed. */
  fxRateToQuote?: number | null;
  targetPrice?: number | null;
  statements: readonly MetricsInputStatement[];
};

export type Metrics = {
  latestFiscalYear: number | null;
  earliestFiscalYear: number | null;
  years: number;
  latestRevenue: number | null;
  marketCap: MetricResult;
  netDebt: MetricResult;
  /** True when net debt is negative (i.e. the company holds net cash). */
  netCash: boolean;
  enterpriseValue: MetricResult;
  revenueGrowth: MetricResult;
  revenueCagr: MetricResult;
  grossMargin: MetricResult;
  ebitdaMargin: MetricResult;
  operatingMargin: MetricResult;
  netMargin: MetricResult;
  fcfMargin: MetricResult;
  evToRevenue: MetricResult;
  evToEbitda: MetricResult;
  peRatio: MetricResult;
  fcfYield: MetricResult;
  returnOnEquity: MetricResult;
  impliedUpside: MetricResult;
  /** Cross-currency metrics were blocked because no explicit FX rate was supplied. */
  currencyMismatch: boolean;
};

export function metricValue(result: MetricResult): number | null {
  return result.status === "ok" ? result.value : null;
}

function latestByYear(statements: readonly MetricsInputStatement[]): MetricsInputStatement[] {
  return [...statements].sort((a, b) => a.fiscalYear - b.fiscalYear);
}

/**
 * Resolve EBITDA, deriving it from operating income + D&A only when the
 * reported figure is missing and both inputs are available.
 */
export function resolveEbitda(statement: MetricsInputStatement): {
  value: number | null;
  derived: boolean;
} {
  if (hasValue(statement.ebitda)) return { value: statement.ebitda, derived: false };
  const derived = deriveEbitda(statement.operatingIncome, statement.depreciationAmortisation);
  return derived.status === "ok" ? { value: derived.value, derived: true } : { value: null, derived: false };
}

export function resolveFreeCashFlow(statement: MetricsInputStatement): {
  value: number | null;
  derived: boolean;
} {
  if (hasValue(statement.freeCashFlow)) return { value: statement.freeCashFlow, derived: false };
  const derived = deriveFreeCashFlow(statement.operatingCashFlow, statement.capex);
  return derived.status === "ok" ? { value: derived.value, derived: true } : { value: null, derived: false };
}

export function computeMetrics(input: MetricsInput): Metrics {
  const statements = latestByYear(input.statements);
  const latest = statements.at(-1) ?? null;
  const earliest = statements.at(0) ?? null;
  const previous = statements.length >= 2 ? statements.at(-2)! : null;

  const reporting = input.reportingCurrency ?? null;
  const quote = input.quoteCurrency ?? null;
  const fx = fxScale(reporting, quote, input.fxRateToQuote);
  const currencyMismatch = input.marketCap != null || input.sharePrice != null ? fx === null : false;

  const marketCapResult = hasValue(input.marketCap)
    ? ok(input.marketCap)
    : marketCapFn(input.sharePrice, input.sharesOutstanding);

  const netDebtResult = netDebtFn(input.totalDebt, input.cash);

  const evResult =
    fx === null
      ? ({ status: "na", reason: "currency_mismatch" } as const)
      : enterpriseValue(metricValue(marketCapResult), input.totalDebt, input.cash, {
          debtScale: fx,
          cashScale: fx,
        });

  const latestRevenue = latest?.revenue ?? null;
  const latestEbitda = latest ? resolveEbitda(latest) : { value: null, derived: false };
  const latestFcf = latest ? resolveFreeCashFlow(latest) : { value: null, derived: false };

  const scaleOrNull = fx;
  const toQuote = (value: number | null | undefined) =>
    scaleOrNull === null || !hasValue(value) ? null : value * scaleOrNull;

  const ebitdaForMultiple = toQuote(latestEbitda.value as number | null);
  const revenueForMultiple = toQuote(latestRevenue as number | null);
  const netIncomeForMultiple = toQuote(latest?.netIncome ?? null);
  const fcfForMultiple = toQuote(latestFcf.value as number | null);

  const ev = metricValue(evResult);

  const years = earliest && latest ? Math.max(0, latest.fiscalYear - earliest.fiscalYear) : 0;

  return {
    latestFiscalYear: latest?.fiscalYear ?? null,
    earliestFiscalYear: earliest?.fiscalYear ?? null,
    years,
    latestRevenue,
    marketCap: marketCapResult,
    netDebt: netDebtResult,
    netCash: netDebtResult.status === "ok" && netDebtResult.value < 0,
    enterpriseValue: evResult,
    revenueGrowth: revenueGrowth(latest?.revenue ?? null, previous?.revenue ?? null),
    revenueCagr: revenueCagr(latest?.revenue ?? null, earliest?.revenue ?? null, years),
    grossMargin: grossMargin(latest?.grossProfit ?? null, latestRevenue),
    ebitdaMargin: ebitdaMargin(latestEbitda.value, latestRevenue),
    operatingMargin: operatingMargin(latest?.operatingIncome ?? null, latestRevenue),
    netMargin: netMargin(latest?.netIncome ?? null, latestRevenue),
    fcfMargin: fcfMargin(latestFcf.value, latestRevenue),
    evToRevenue: evToRevenue(ev, revenueForMultiple),
    evToEbitda: evToEbitda(ev, ebitdaForMultiple),
    peRatio: peRatio(metricValue(marketCapResult), netIncomeForMultiple),
    fcfYield: fcfYield(fcfForMultiple, metricValue(marketCapResult)),
    returnOnEquity: returnOnEquity(
      latest?.netIncome ?? null,
      previous?.shareholdersEquity ?? null,
      latest?.shareholdersEquity ?? null,
    ),
    impliedUpside: impliedUpside(input.targetPrice, input.sharePrice),
    currencyMismatch,
  };
}