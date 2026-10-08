import type { MetricResult } from "@/lib/finance/calculations";

const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const NUMBER_1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const NUMBER_2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  if (digits === 0) return NUMBER.format(value);
  if (digits === 1) return NUMBER_1.format(value);
  return NUMBER_2.format(value);
}

/** Money in millions of `currency`, e.g. "USD 1,234m". */
export function formatMoney(
  value: number | null | undefined,
  currency: string | null | undefined,
  { suffix = "m" }: { suffix?: string } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  const prefix = currency ? `${currency} ` : "";
  const sign = value < 0 ? "-" : "";
  return `${sign}${prefix}${formatNumber(Math.abs(value))}${suffix}`;
}

export function formatCurrencyValue(
  value: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  return `${currency ? `${currency} ` : ""}${NUMBER_2.format(value)}`;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  const formatter = digits === 0 ? NUMBER : digits === 1 ? NUMBER_1 : NUMBER_2;
  return `${formatter.format(value * 100)}%`;
}

export function formatMultiple(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  return `${NUMBER_1.format(value)}x`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/** Human labels for a metric that has no numeric value. */
export function metricPlaceholder(reason: Extract<MetricResult, { status: "na" }>["reason"]): string {
  switch (reason) {
    case "missing_inputs":
    case "no_periods":
      return "N/A";
    case "currency_mismatch":
      return "N/A (currency)";
    case "zero_denominator":
    case "not_meaningful":
      return "Not meaningful";
  }
}

export type MetricFormatter = (value: number) => string;

export const asPercent: MetricFormatter = (value) => formatPercent(value);
export const asMultiple: MetricFormatter = (value) => formatMultiple(value);

/** Render a MetricResult using a formatter, or an explanatory placeholder. */
export function formatMetric(result: MetricResult, formatter: MetricFormatter): string {
  return result.status === "ok" ? formatter(result.value) : metricPlaceholder(result.reason);
}

/** Whether a ratio with negative earnings/EBITDA should be shown as "not meaningful". */
export function isNegativeEarnings(result: MetricResult): boolean {
  return (
    result.status === "ok" && result.value < 0 && Number.isFinite(result.value)
  );
}