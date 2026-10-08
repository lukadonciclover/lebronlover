import { z } from "zod";
import {
  CURRENCIES,
  MAX_FISCAL_YEARS,
  RECOMMENDATIONS,
  THESIS_SUMMARY_MAX,
} from "@/lib/constants";
import { INCOME_FIELDS, BALANCE_FIELDS, CASHFLOW_FIELDS } from "@/lib/finance/types";

const EMPTY = new Set(["", null, undefined]);

/** Coerce form strings/numbers to a finite number or null (never NaN). */
function toNumberOrNull(value: unknown): number | null | typeof NaN {
  if (typeof value === "string" && EMPTY.has(value.trim())) return null;
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
}

export const nullableNumber = z.preprocess(
  toNumberOrNull,
  z
    .number({ error: "Enter a valid number" })
    .finite({ error: "Enter a finite number" })
    .nullable(),
);

export const requiredNumber = z.preprocess(
  (value) => (EMPTY.has(value as string | null | undefined) ? Number.NaN : toNumberOrNull(value)),
  z.number({ error: "Enter a valid number" }).finite({ error: "Enter a finite number" }),
);

const nonNegative = (schema: z.ZodType<number | null>) =>
  schema.refine((value) => value === null || value >= 0, { error: "Must be zero or greater" });

const positive = (schema: z.ZodType<number | null>) =>
  schema.refine((value) => value === null || value > 0, { error: "Must be greater than zero" });

export const currencySchema = z
  .string()
  .trim()
  .min(3, { error: "Enter a 3-letter currency code" })
  .max(8)
  .transform((value) => value.toUpperCase());

export const optionalCurrencySchema = z
  .preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().min(3).max(8).transform((v) => v.toUpperCase()).nullable(),
  )
  .optional();

export const tickerSchema = z
  .string()
  .trim()
  .min(1, { error: "Ticker is required" })
  .max(24)
  .transform((value) => value.toUpperCase());

export const searchQuerySchema = z.string().trim().min(1, { error: "Enter a ticker or name" }).max(64);

export const fiscalYearSchema = z.preprocess(
  (value) => toNumberOrNull(value),
  z
    .number({ error: "Fiscal year is required" })
    .int({ error: "Fiscal year must be a whole number" })
    .min(1900, { error: "Fiscal year looks too early" })
    .max(2100, { error: "Fiscal year looks too late" }),
);

const financialField = (extra?: z.ZodType<number | null>) => {
  const base = extra ?? nullableNumber;
  return base.optional();
};

export const statementInputSchema = z.object({
  fiscalYear: fiscalYearSchema,
  periodStart: z.string().trim().nullable().optional(),
  periodEnd: z.string().trim().nullable().optional(),
  filingDate: z.string().trim().nullable().optional(),
  source: z.string().trim().max(200).nullable().optional(),
  sourceUrl: z.string().trim().max(500).nullable().optional(),
  retrievalDate: z.string().trim().nullable().optional(),
  originalCurrency: z.string().trim().max(8).nullable().optional(),
  originalUnits: z.enum(["units", "thousands", "millions", "billions"]).nullable().optional(),
  manual: z.boolean().optional(),
  fieldMeta: z.record(z.string(), z.enum(["reported", "derived", "manual"])).optional(),

  // Core income statement fields.
  revenue: financialField(nonNegative(nullableNumber)),
  costOfRevenue: financialField(),
  grossProfit: financialField(),
  ebitda: financialField(),
  depreciationAmortisation: financialField(),
  operatingIncome: financialField(),
  netIncome: financialField(),
  eps: financialField(),

  cashAndEquivalents: financialField(nonNegative(nullableNumber)),
  shortTermInvestments: financialField(nonNegative(nullableNumber)),
  totalAssets: financialField(),
  currentAssets: financialField(),
  currentLiabilities: financialField(),
  shortTermDebt: financialField(nonNegative(nullableNumber)),
  longTermDebt: financialField(nonNegative(nullableNumber)),
  totalDebt: financialField(nonNegative(nullableNumber)),
  totalLiabilities: financialField(),
  shareholdersEquity: financialField(),

  operatingCashFlow: financialField(),
  capex: financialField(),
  freeCashFlow: financialField(),
  acquisitions: financialField(),
  dividendsPaid: financialField(),
  shareRepurchases: financialField(),
});

export const financialYearsSchema = z
  .array(statementInputSchema)
  .min(1, { error: "Add at least one fiscal year" })
  .max(MAX_FISCAL_YEARS, { error: `A maximum of ${MAX_FISCAL_YEARS} fiscal years is supported` })
  .superRefine((years, ctx) => {
    const seen = new Map<number, number>();
    years.forEach((year, index) => {
      const firstIndex = seen.get(year.fiscalYear);
      if (firstIndex !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: `Fiscal year ${year.fiscalYear} is duplicated`,
          path: [index, "fiscalYear"],
        });
      } else {
        seen.set(year.fiscalYear, index);
      }
    });
  });

export const analysisCoreSchema = z.object({
  companyName: z.string().trim().min(1, { error: "Company name is required" }).max(200),
  ticker: tickerSchema,
  industry: z.string().trim().max(200).nullable().optional(),
  sector: z.string().trim().max(200).nullable().optional(),
  exchange: z.string().trim().max(100).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  securityType: z.string().trim().max(60).nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),

  reportingCurrency: currencySchema,
  quoteCurrency: optionalCurrencySchema,

  sharePrice: financialField(nonNegative(nullableNumber)),
  quoteDate: z.string().trim().nullable().optional(),
  sharesOutstanding: financialField(positive(nullableNumber)),
  sharesOutstandingDate: z.string().trim().nullable().optional(),
  marketCap: financialField(nonNegative(nullableNumber)),
  marketCapDate: z.string().trim().nullable().optional(),

  cash: financialField(nonNegative(nullableNumber)),
  cashDate: z.string().trim().nullable().optional(),
  totalDebt: financialField(nonNegative(nullableNumber)),
  debtDate: z.string().trim().nullable().optional(),

  fxRateToQuote: financialField(positive(nullableNumber)),

  source: z.string().trim().max(200).nullable().optional(),
  sourceUrl: z.string().trim().max(500).nullable().optional(),
  retrievalDate: z.string().trim().nullable().optional(),
});

export const manualAnalysisSchema = analysisCoreSchema.extend({
  years: financialYearsSchema,
});

export const analysisUpdateSchema = z.object({
  fields: analysisCoreSchema.partial().optional(),
  years: financialYearsSchema.optional(),
});

export const thesisSchema = z.object({
  recommendation: z.enum(RECOMMENDATIONS).nullable().optional(),
  targetPrice: financialField(nonNegative(nullableNumber)),
  summary: z
    .string()
    .max(THESIS_SUMMARY_MAX, { error: `Keep the thesis under ${THESIS_SUMMARY_MAX} characters` })
    .optional()
    .transform((value) => (value ?? "").trim()),
  catalysts: z
    .array(z.string())
    .optional()
    .transform((items) => (items ?? []).map((item) => item.trim()).filter(Boolean)),
  risks: z
    .array(z.string())
    .optional()
    .transform((items) => (items ?? []).map((item) => item.trim()).filter(Boolean)),
});

export const demoSchema = z.object({
  includeDemo: z.boolean().optional(),
});

export type ManualAnalysisInput = z.infer<typeof manualAnalysisSchema>;
export type AnalysisCoreInput = z.infer<typeof analysisCoreSchema>;
export type AnalysisUpdateInput = z.infer<typeof analysisUpdateSchema>;
export type ThesisFormInput = z.infer<typeof thesisSchema>;
export type StatementFormInput = z.infer<typeof statementInputSchema>;

export { CURRENCIES, INCOME_FIELDS, BALANCE_FIELDS, CASHFLOW_FIELDS };

/** Format Zod issues into a field-keyed map for inline form messages. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}