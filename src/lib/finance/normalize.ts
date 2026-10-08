import { FINANCIAL_FIELDS, type FinancialField, type FinancialValues } from "@/lib/finance/types";
import type { NormalizedAnnualStatement, RawAnnualStatement } from "@/lib/finance/types";
import type { UnitScale } from "@/lib/constants";

const MULTIPLIER: Record<UnitScale, number> = {
  units: 1 / 1_000_000,
  thousands: 1 / 1_000,
  millions: 1,
  billions: 1_000,
};

/**
 * Convert a monetary value into millions without ever double converting.
 *
 * The `units` argument describes the *original* units of `value`. Passing
 * `null`/`undefined` means "already millions" (the application's canonical
 * unit) so a value is never silently rescaled twice.
 */
export function toMillions(value: number | null | undefined, units?: UnitScale | null): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  if (!units) return value;
  return value * MULTIPLIER[units];
}

const PER_SHARE_FIELDS: ReadonlySet<FinancialField> = new Set(["eps"]);

function emptyValues(): FinancialValues {
  const out = {} as FinancialValues;
  for (const field of FINANCIAL_FIELDS) out[field] = null;
  return out;
}

/**
 * Normalise a single raw statement into the canonical schema.
 * Missing values stay null; a genuine zero stays zero.
 */
export function normalizeStatement(raw: RawAnnualStatement): NormalizedAnnualStatement {
  const values = emptyValues();
  for (const field of FINANCIAL_FIELDS) {
    const value = raw.values[field];
    values[field] =
      value === undefined || value === null
        ? null
        : PER_SHARE_FIELDS.has(field)
          ? value
          : toMillions(value, raw.units);
  }

  return {
    ...values,
    fiscalYear: raw.fiscalYear,
    periodStart: raw.periodStart ?? null,
    periodEnd: raw.periodEnd ?? null,
    filingDate: raw.filingDate ?? null,
    retrievalDate: new Date().toISOString(),
    source: "",
    sourceUrl: null,
    originalCurrency: raw.currency ?? null,
    originalUnits: raw.units ?? null,
    manual: false,
    fieldMeta: raw.fieldMeta ?? {},
  };
}

export function normalizeStatements(raw: readonly RawAnnualStatement[]): NormalizedAnnualStatement[] {
  return sortStatements(raw.map(normalizeStatement));
}

/** Chronological order (oldest first) with fiscal year as the stable tiebreaker. */
export function sortStatements<T extends { fiscalYear: number; periodEnd?: string | null }>(
  statements: readonly T[],
): T[] {
  return [...statements].sort((a, b) => {
    if (a.fiscalYear !== b.fiscalYear) return a.fiscalYear - b.fiscalYear;
    return (a.periodEnd ?? "").localeCompare(b.periodEnd ?? "");
  });
}

/** True when the value is a real number (0 is valid, null/undefined/NaN are not). */
export function hasValue(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

/** Number of years actually elapsed between two fiscal years. */
export function elapsedYears(earliestFiscalYear: number, latestFiscalYear: number): number {
  return Math.max(0, latestFiscalYear - earliestFiscalYear);
}