import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { analyses, annualFinancials, theses } from "@/lib/db/schema";
import type { AnalysisRow, AnnualFinancialRow, ThesisRow } from "@/lib/db/schema";
import {
  FINANCIAL_FIELDS,
  type FieldMeta,
  type FinancialField,
  type NormalizedAnnualStatement,
} from "@/lib/finance/types";
import type { Recommendation } from "@/lib/constants";

export type AnalysisRecord = {
  id: string;
  workspaceId: string;
  isDemo: boolean;
  companyName: string;
  ticker: string;
  industry: string | null;
  sector: string | null;
  exchange: string | null;
  country: string | null;
  securityType: string | null;
  description: string | null;
  reportingCurrency: string;
  quoteCurrency: string | null;
  sharePrice: number | null;
  quoteDate: string | null;
  sharesOutstanding: number | null;
  sharesOutstandingDate: string | null;
  marketCap: number | null;
  marketCapDate: string | null;
  cash: number | null;
  cashDate: string | null;
  totalDebt: number | null;
  debtDate: string | null;
  fxRateToQuote: number | null;
  source: string | null;
  sourceUrl: string | null;
  retrievalDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinancialRecord = NormalizedAnnualStatement & {
  id: string;
  analysisId: string;
  fieldMeta: FieldMeta;
};

export type ThesisRecord = {
  analysisId: string;
  recommendation: Recommendation | null;
  targetPrice: number | null;
  summary: string;
  catalysts: string[];
  risks: string[];
  updatedAt: string;
};

export type AnalysisWithData = {
  analysis: AnalysisRecord;
  statements: FinancialRecord[];
  thesis: ThesisRecord | null;
};

export type AnalysisSummary = {
  analysis: AnalysisRecord;
  latestStatement: FinancialRecord | null;
  recommendation: Recommendation | null;
  targetPrice: number | null;
};

export type AnalysisCreateInput = Omit<AnalysisRecord, "id" | "isDemo" | "createdAt" | "updatedAt"> & {
  id?: string;
  isDemo?: boolean;
};

export type AnalysisPatch = Partial<
  Omit<AnalysisRecord, "id" | "workspaceId" | "isDemo" | "createdAt" | "updatedAt">
>;

export type StatementInput = Omit<
  Partial<NormalizedAnnualStatement>,
  "source" | "retrievalDate"
> & {
  fiscalYear: number;
  source?: string | null;
  retrievalDate?: string | null;
};

export type ThesisInput = {
  recommendation?: Recommendation | null;
  targetPrice?: number | null;
  summary?: string | null;
  catalysts?: string[] | null;
  risks?: string[] | null;
};

/** Either the root db handle or a transaction (same query surface). */
type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Executor = Db | Transaction;

function nowIso(): string {
  return new Date().toISOString();
}

function toAnalysisRecord(row: AnalysisRow): AnalysisRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    isDemo: Boolean(row.isDemo),
    companyName: row.companyName,
    ticker: row.ticker,
    industry: row.industry,
    sector: row.sector,
    exchange: row.exchange,
    country: row.country,
    securityType: row.securityType,
    description: row.description,
    reportingCurrency: row.reportingCurrency,
    quoteCurrency: row.quoteCurrency,
    sharePrice: row.sharePrice,
    quoteDate: row.quoteDate,
    sharesOutstanding: row.sharesOutstanding,
    sharesOutstandingDate: row.sharesOutstandingDate,
    marketCap: row.marketCap,
    marketCapDate: row.marketCapDate,
    cash: row.cash,
    cashDate: row.cashDate,
    totalDebt: row.totalDebt,
    debtDate: row.debtDate,
    fxRateToQuote: row.fxRateToQuote,
    source: row.source,
    sourceUrl: row.sourceUrl,
    retrievalDate: row.retrievalDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseFieldMeta(raw: string | null): FieldMeta {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as FieldMeta) : {};
  } catch {
    return {};
  }
}

function toFinancialRecord(row: AnnualFinancialRow): FinancialRecord {
  const values = {} as Record<FinancialField, number | null>;
  for (const field of FINANCIAL_FIELDS) {
    values[field] = (row as unknown as Record<string, number | null>)[field] ?? null;
  }
  return {
    id: row.id,
    analysisId: row.analysisId,
    fiscalYear: row.fiscalYear,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    filingDate: row.filingDate,
    retrievalDate: row.retrievalDate ?? "",
    source: row.source ?? "",
    sourceUrl: row.sourceUrl,
    originalCurrency: row.originalCurrency,
    originalUnits: (row.originalUnits as NormalizedAnnualStatement["originalUnits"]) ?? null,
    manual: Boolean(row.manual),
    fieldMeta: parseFieldMeta(row.fieldMeta),
    ...values,
  };
}

function toThesisRecord(row: ThesisRow): ThesisRecord {
  const parseList = (raw: string | null): string[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  };
  return {
    analysisId: row.analysisId,
    recommendation: (row.recommendation as Recommendation | null) ?? null,
    targetPrice: row.targetPrice,
    summary: row.summary ?? "",
    catalysts: parseList(row.catalysts),
    risks: parseList(row.risks),
    updatedAt: row.updatedAt,
  };
}

function financialColumns(statement: StatementInput): Record<string, number | null | undefined> {
  const out: Record<string, number | null | undefined> = {};
  for (const field of FINANCIAL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(statement, field)) {
      out[field] = (statement as Partial<Record<FinancialField, number | null>>)[field] ?? null;
    }
  }
  return out;
}

function analysisValues(record: AnalysisRecord): Record<string, unknown> {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    isDemo: record.isDemo,
    companyName: record.companyName,
    ticker: record.ticker,
    industry: record.industry,
    sector: record.sector,
    exchange: record.exchange,
    country: record.country,
    securityType: record.securityType,
    description: record.description,
    reportingCurrency: record.reportingCurrency,
    quoteCurrency: record.quoteCurrency,
    sharePrice: record.sharePrice,
    quoteDate: record.quoteDate,
    sharesOutstanding: record.sharesOutstanding,
    sharesOutstandingDate: record.sharesOutstandingDate,
    marketCap: record.marketCap,
    marketCapDate: record.marketCapDate,
    cash: record.cash,
    cashDate: record.cashDate,
    totalDebt: record.totalDebt,
    debtDate: record.debtDate,
    fxRateToQuote: record.fxRateToQuote,
    source: record.source,
    sourceUrl: record.sourceUrl,
    retrievalDate: record.retrievalDate,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function statementValues(
  analysisId: string,
  statement: StatementInput,
  timestamp: string,
): Record<string, unknown> {
  return {
    id: randomUUID(),
    analysisId,
    fiscalYear: statement.fiscalYear,
    periodStart: statement.periodStart ?? null,
    periodEnd: statement.periodEnd ?? null,
    filingDate: statement.filingDate ?? null,
    source: statement.source ?? null,
    sourceUrl: statement.sourceUrl ?? null,
    retrievalDate: statement.retrievalDate ?? timestamp,
    originalCurrency: statement.originalCurrency ?? null,
    originalUnits: statement.originalUnits ?? null,
    manual: statement.manual ?? false,
    fieldMeta: JSON.stringify(statement.fieldMeta ?? {}),
    ...financialColumns(statement),
  };
}

export async function createAnalysis(
  db: Db,
  input: AnalysisCreateInput,
  statements: readonly StatementInput[] = [],
): Promise<AnalysisRecord> {
  const timestamp = nowIso();
  const record: AnalysisRecord = {
    ...input,
    id: input.id ?? randomUUID(),
    isDemo: input.isDemo ?? false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.transaction(async (tx) => {
    await tx.insert(analyses).values(analysisValues(record) as never).run();
    if (statements.length > 0) {
      await tx
        .insert(annualFinancials)
        .values(statements.map((statement) => statementValues(record.id, statement, timestamp)) as never)
        .run();
    }
  });
  return record;
}

/**
 * Merge statements for an analysis without clobbering untouched values.
 *
 * - A field present in the incoming payload (even as `null`) is written.
 * - A field absent from the payload is left exactly as stored.
 * - Fiscal years absent from the payload are preserved by default; pass
 *   `removeMissing: true` (or list explicit `removedYears`) to delete them.
 */
export async function saveStatements(
  db: Db,
  analysisId: string,
  statements: readonly StatementInput[],
  options: { removeMissing?: boolean; removedYears?: number[] } = {},
): Promise<FinancialRecord[]> {
  const timestamp = nowIso();
  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(annualFinancials)
      .where(eq(annualFinancials.analysisId, analysisId))
      .all();
    const existingByYear = new Map(existing.map((row) => [row.fiscalYear, row]));
    const incomingYears = new Set(statements.map((statement) => statement.fiscalYear));

    for (const statement of statements) {
      const current = existingByYear.get(statement.fiscalYear);
      const metadata: Record<string, unknown> = {};
      if (Object.prototype.hasOwnProperty.call(statement, "source"))
        metadata.source = statement.source ?? null;
      if (Object.prototype.hasOwnProperty.call(statement, "sourceUrl"))
        metadata.sourceUrl = statement.sourceUrl ?? null;
      if (Object.prototype.hasOwnProperty.call(statement, "retrievalDate"))
        metadata.retrievalDate = statement.retrievalDate ?? timestamp;
      if (Object.prototype.hasOwnProperty.call(statement, "originalCurrency"))
        metadata.originalCurrency = statement.originalCurrency ?? null;
      if (Object.prototype.hasOwnProperty.call(statement, "originalUnits"))
        metadata.originalUnits = statement.originalUnits ?? null;
      if (Object.prototype.hasOwnProperty.call(statement, "manual"))
        metadata.manual = statement.manual ?? false;
      if (Object.prototype.hasOwnProperty.call(statement, "periodStart"))
        metadata.periodStart = statement.periodStart ?? null;
      if (Object.prototype.hasOwnProperty.call(statement, "periodEnd"))
        metadata.periodEnd = statement.periodEnd ?? null;
      if (Object.prototype.hasOwnProperty.call(statement, "filingDate"))
        metadata.filingDate = statement.filingDate ?? null;
      if (Object.prototype.hasOwnProperty.call(statement, "fieldMeta"))
        metadata.fieldMeta = JSON.stringify(statement.fieldMeta ?? {});

      if (current) {
        await tx
          .update(annualFinancials)
          .set({ ...financialColumns(statement), ...metadata })
          .where(eq(annualFinancials.id, current.id))
          .run();
      } else {
        await tx
          .insert(annualFinancials)
          .values(statementValues(analysisId, statement, timestamp) as never)
          .run();
      }
    }

    const explicitRemovals = new Set(options.removedYears ?? []);
    const removeIds = new Set<string>();
    for (const row of existing) {
      if (!incomingYears.has(row.fiscalYear) && (options.removeMissing || explicitRemovals.has(row.fiscalYear))) {
        removeIds.add(row.id);
      }
    }
    if (removeIds.size > 0) {
      await tx.delete(annualFinancials).where(inArray(annualFinancials.id, [...removeIds])).run();
    }

    const rows = await tx
      .select()
      .from(annualFinancials)
      .where(eq(annualFinancials.analysisId, analysisId))
      .all();
    return rows.map(toFinancialRecord).sort((a, b) => a.fiscalYear - b.fiscalYear);
  });
}

/**
 * Apply a partial patch. Only keys present on `patch` are written; an explicit
 * `null` clears a field, while an absent key preserves the stored value.
 */
export async function updateAnalysis(
  db: Db,
  analysisId: string,
  patch: AnalysisPatch,
): Promise<AnalysisRecord | null> {
  const set: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as (keyof AnalysisPatch)[]) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    set[key] = patch[key];
  }
  if (Object.keys(set).length === 0) {
    return (await getAnalysis(db, analysisId))?.analysis ?? null;
  }
  set.updatedAt = nowIso();
  const result = await db.update(analyses).set(set).where(eq(analyses.id, analysisId)).run();
  if (result.rowsAffected === 0) return null;
  return (await getAnalysis(db, analysisId))?.analysis ?? null;
}

export async function getAnalysis(
  db: Db,
  analysisId: string,
  workspaceId?: string | null,
): Promise<AnalysisWithData | null> {
  const row = await db.select().from(analyses).where(eq(analyses.id, analysisId)).get();
  if (!row) return null;
  if (workspaceId && row.workspaceId !== workspaceId && !row.isDemo) return null;
  const statementRows = await db
    .select()
    .from(annualFinancials)
    .where(eq(annualFinancials.analysisId, analysisId))
    .all();
  const thesisRow = await db.select().from(theses).where(eq(theses.analysisId, analysisId)).get();
  return {
    analysis: toAnalysisRecord(row),
    statements: statementRows.map(toFinancialRecord).sort((a, b) => a.fiscalYear - b.fiscalYear),
    thesis: thesisRow ? toThesisRecord(thesisRow) : null,
  };
}

export async function listAnalyses(db: Db, workspaceId: string): Promise<AnalysisSummary[]> {
  const analysisRows = (
    await db.select().from(analyses).where(eq(analyses.workspaceId, workspaceId)).all()
  )
    .map(toAnalysisRecord)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (analysisRows.length === 0) return [];
  const ids = analysisRows.map((row) => row.id);

  const statementRows = (
    await db.select().from(annualFinancials).where(inArray(annualFinancials.analysisId, ids)).all()
  ).map(toFinancialRecord);

  const thesisRows = await db.select().from(theses).where(inArray(theses.analysisId, ids)).all();

  const latestByAnalysis = new Map<string, FinancialRecord>();
  for (const statement of statementRows) {
    const current = latestByAnalysis.get(statement.analysisId);
    if (!current || statement.fiscalYear >= current.fiscalYear) {
      latestByAnalysis.set(statement.analysisId, statement);
    }
  }
  const thesisByAnalysis = new Map(thesisRows.map((row) => [row.analysisId, toThesisRecord(row)]));

  return analysisRows.map((analysis) => {
    const thesis = thesisByAnalysis.get(analysis.id) ?? null;
    return {
      analysis,
      latestStatement: latestByAnalysis.get(analysis.id) ?? null,
      recommendation: thesis?.recommendation ?? null,
      targetPrice: thesis?.targetPrice ?? null,
    };
  });
}

export async function deleteAnalysis(
  db: Db,
  analysisId: string,
  workspaceId: string,
): Promise<boolean> {
  const row = await db.select().from(analyses).where(eq(analyses.id, analysisId)).get();
  if (!row || row.workspaceId !== workspaceId) return false;
  await db.transaction(async (tx) => {
    await tx.delete(annualFinancials).where(eq(annualFinancials.analysisId, analysisId)).run();
    await tx.delete(theses).where(eq(theses.analysisId, analysisId)).run();
    await tx.delete(analyses).where(eq(analyses.id, analysisId)).run();
  });
  return true;
}

export async function saveThesis(
  db: Db,
  analysisId: string,
  workspaceId: string,
  input: ThesisInput,
  isDemo = false,
): Promise<ThesisRecord | null> {
  const row = await db.select().from(analyses).where(eq(analyses.id, analysisId)).get();
  if (!row || (row.workspaceId !== workspaceId && !isDemo)) return null;

  const existingRow = await db.select().from(theses).where(eq(theses.analysisId, analysisId)).get();
  const existing = existingRow ? toThesisRecord(existingRow) : null;
  const timestamp = nowIso();

  const next: ThesisRecord = {
    analysisId,
    recommendation:
      input.recommendation !== undefined
        ? (input.recommendation ?? null)
        : (existing?.recommendation ?? null),
    targetPrice:
      input.targetPrice !== undefined ? (input.targetPrice ?? null) : (existing?.targetPrice ?? null),
    summary: input.summary !== undefined ? (input.summary ?? "") : (existing?.summary ?? ""),
    catalysts: input.catalysts !== undefined ? (input.catalysts ?? []) : (existing?.catalysts ?? []),
    risks: input.risks !== undefined ? (input.risks ?? []) : (existing?.risks ?? []),
    updatedAt: timestamp,
  };

  await db.transaction(async (tx) => {
    if (existingRow) {
      await tx
        .update(theses)
        .set({
          recommendation: next.recommendation,
          targetPrice: next.targetPrice,
          summary: next.summary,
          catalysts: JSON.stringify(next.catalysts),
          risks: JSON.stringify(next.risks),
          updatedAt: timestamp,
        })
        .where(eq(theses.analysisId, analysisId))
        .run();
    } else {
      await tx
        .insert(theses)
        .values({
          analysisId,
          workspaceId: row.workspaceId,
          recommendation: next.recommendation,
          targetPrice: next.targetPrice,
          summary: next.summary,
          catalysts: JSON.stringify(next.catalysts),
          risks: JSON.stringify(next.risks),
          updatedAt: timestamp,
        })
        .run();
    }
    await tx.update(analyses).set({ updatedAt: timestamp }).where(eq(analyses.id, analysisId)).run();
  });
  return next;
}

export async function countAnalyses(db: Db, workspaceId: string): Promise<number> {
  const rows = await db.select().from(analyses).where(eq(analyses.workspaceId, workspaceId)).all();
  return rows.length;
}

export async function ownsAnalysis(
  db: Db,
  analysisId: string,
  workspaceId: string,
): Promise<boolean> {
  const row = await db.select().from(analyses).where(eq(analyses.id, analysisId)).get();
  return Boolean(row && row.workspaceId === workspaceId);
}