import { elapsedYears, hasValue } from "@/lib/finance/normalize";

/**
 * Pure financial calculations. Every function is unit-testable and never
 * returns NaN or Infinity: unsuitable inputs produce an explicit `na` result
 * with a reason the UI can turn into "N/A" or "Not meaningful".
 */

export type MetricReason =
  | "missing_inputs"
  | "zero_denominator"
  | "not_meaningful"
  | "currency_mismatch"
  | "no_periods";

export type MetricResult =
  | { status: "ok"; value: number }
  | { status: "na"; reason: MetricReason };

export const na = (reason: MetricReason): MetricResult => ({ status: "na", reason });
export const ok = (value: number): MetricResult =>
  Number.isFinite(value) ? { status: "ok", value } : na("not_meaningful");

/** Market capitalisation = share price × shares outstanding (shares in millions). */
export function marketCap(
  sharePrice: number | null | undefined,
  sharesOutstanding: number | null | undefined,
): MetricResult {
  if (!hasValue(sharePrice) || !hasValue(sharesOutstanding)) return na("missing_inputs");
  return ok(sharePrice * sharesOutstanding);
}

/** Net debt = total debt − cash and cash equivalents. Negative means net cash. */
export function netDebt(
  totalDebt: number | null | undefined,
  cash: number | null | undefined,
): MetricResult {
  if (!hasValue(totalDebt) || !hasValue(cash)) return na("missing_inputs");
  return ok(totalDebt - cash);
}

/**
 * Enterprise value = market cap + total debt − cash.
 * `debtScale`/`cashScale` convert the balance-sheet figures into the currency
 * of the market cap when they are reported in a different currency. It defaults
 * to 1 (same currency) and must be explicit otherwise.
 */
export function enterpriseValue(
  marketCapValue: number | null | undefined,
  totalDebtValue: number | null | undefined,
  cashValue: number | null | undefined,
  scales: { debtScale?: number; cashScale?: number } = {},
): MetricResult {
  if (!hasValue(marketCapValue) || !hasValue(totalDebtValue) || !hasValue(cashValue)) {
    return na("missing_inputs");
  }
  const debtScale = scales.debtScale ?? 1;
  const cashScale = scales.cashScale ?? 1;
  return ok(marketCapValue + totalDebtValue * debtScale - cashValue * cashScale);
}

/** Revenue growth = current / previous − 1. */
export function revenueGrowth(
  current: number | null | undefined,
  previous: number | null | undefined,
): MetricResult {
  if (!hasValue(current) || !hasValue(previous)) return na("missing_inputs");
  if (previous === 0) return na("zero_denominator");
  if (previous < 0 || current < 0) return na("not_meaningful");
  return ok(current / previous - 1);
}

/** Revenue CAGR = (latest / earliest)^(1 / elapsedYears) − 1. */
export function revenueCagr(
  latest: number | null | undefined,
  earliest: number | null | undefined,
  years: number,
): MetricResult {
  if (!hasValue(latest) || !hasValue(earliest)) return na("missing_inputs");
  if (!Number.isFinite(years) || years <= 0) return na("no_periods");
  if (earliest <= 0 || latest <= 0) return na("not_meaningful");
  return ok(Math.pow(latest / earliest, 1 / years) - 1);
}

function margin(numerator: number | null | undefined, revenue: number | null | undefined): MetricResult {
  if (!hasValue(numerator) || !hasValue(revenue)) return na("missing_inputs");
  if (revenue === 0) return na("zero_denominator");
  if (revenue < 0) return na("not_meaningful");
  return ok(numerator / revenue);
}

export const grossMargin = (grossProfit: number | null | undefined, revenue: number | null | undefined) =>
  margin(grossProfit, revenue);

export const ebitdaMargin = (ebitda: number | null | undefined, revenue: number | null | undefined) =>
  margin(ebitda, revenue);

export const operatingMargin = (
  operatingIncome: number | null | undefined,
  revenue: number | null | undefined,
) => margin(operatingIncome, revenue);

export const netMargin = (netIncome: number | null | undefined, revenue: number | null | undefined) =>
  margin(netIncome, revenue);

export const fcfMargin = (freeCashFlow: number | null | undefined, revenue: number | null | undefined) =>
  margin(freeCashFlow, revenue);

/** A ratio where a non-positive denominator makes the multiple meaningless. */
function multiple(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): MetricResult {
  if (!hasValue(numerator) || !hasValue(denominator)) return na("missing_inputs");
  if (denominator === 0) return na("zero_denominator");
  if (denominator < 0) return na("not_meaningful");
  return ok(numerator / denominator);
}

export function evToRevenue(
  ev: number | null | undefined,
  revenue: number | null | undefined,
): MetricResult {
  return multiple(ev, revenue);
}

export function evToEbitda(
  ev: number | null | undefined,
  ebitda: number | null | undefined,
): MetricResult {
  return multiple(ev, ebitda);
}

export function peRatio(
  marketCapValue: number | null | undefined,
  netIncome: number | null | undefined,
): MetricResult {
  return multiple(marketCapValue, netIncome);
}

export function fcfYield(
  freeCashFlow: number | null | undefined,
  marketCapValue: number | null | undefined,
): MetricResult {
  if (!hasValue(freeCashFlow) || !hasValue(marketCapValue)) return na("missing_inputs");
  if (marketCapValue === 0) return na("zero_denominator");
  if (marketCapValue < 0) return na("not_meaningful");
  return ok(freeCashFlow / marketCapValue);
}

/** Implied upside = target price / current share price − 1. */
export function impliedUpside(
  targetPrice: number | null | undefined,
  currentPrice: number | null | undefined,
): MetricResult {
  if (!hasValue(targetPrice) || !hasValue(currentPrice)) return na("missing_inputs");
  if (currentPrice === 0) return na("zero_denominator");
  if (currentPrice < 0) return na("not_meaningful");
  return ok(targetPrice / currentPrice - 1);
}

/**
 * Return on equity. Convention: net income divided by the average of beginning
 * and ending shareholders' equity. Returns N/A when either equity figure is
 * unavailable rather than silently using a different denominator.
 */
export function returnOnEquity(
  netIncome: number | null | undefined,
  beginningEquity: number | null | undefined,
  endingEquity: number | null | undefined,
): MetricResult {
  if (!hasValue(netIncome) || !hasValue(beginningEquity) || !hasValue(endingEquity)) {
    return na("missing_inputs");
  }
  const average = (beginningEquity + endingEquity) / 2;
  if (average === 0) return na("zero_denominator");
  if (average < 0) return na("not_meaningful");
  return ok(netIncome / average);
}

export const ROE_CONVENTION = "net income ÷ average of beginning and ending shareholders' equity";

/**
 * Derive EBITDA from operating income + depreciation & amortisation when both
 * are available. The result must be labelled "derived" in the UI.
 */
export function deriveEbitda(
  operatingIncome: number | null | undefined,
  depreciationAmortisation: number | null | undefined,
): MetricResult {
  if (!hasValue(operatingIncome) || !hasValue(depreciationAmortisation)) {
    return na("missing_inputs");
  }
  return ok(operatingIncome + Math.abs(depreciationAmortisation));
}

/**
 * Derive free cash flow = operating cash flow − capital expenditure.
 * Capex is treated as a magnitude (its sign is ignored) so that providers which
 * report capex as a negative outflow and those that report a positive spend
 * both produce a consistent FCF. This convention is documented in the README.
 */
export function deriveFreeCashFlow(
  operatingCashFlow: number | null | undefined,
  capex: number | null | undefined,
): MetricResult {
  if (!hasValue(operatingCashFlow) || !hasValue(capex)) return na("missing_inputs");
  return ok(operatingCashFlow - Math.abs(capex));
}

/**
 * Resolve an FX scale so a value can be expressed in the target currency.
 * Never assumes a rate: if currencies differ and no explicit rate is supplied
 * the conversion is refused.
 */
export function fxScale(
  fromCurrency: string | null | undefined,
  toCurrency: string | null | undefined,
  explicitRate: number | null | undefined,
): number | null {
  if (!fromCurrency || !toCurrency) {
    // Unknown currencies: only safe when no conversion is required.
    return fromCurrency === toCurrency ? 1 : null;
  }
  if (fromCurrency === toCurrency) return 1;
  if (hasValue(explicitRate) && explicitRate > 0) return explicitRate;
  return null;
}

export { elapsedYears };