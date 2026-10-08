"use server";

import { z } from "zod";
import { getWorkspaceContext } from "@/lib/server-context";
import { canWrite } from "@/lib/workspace";
import { AppError } from "@/lib/errors";
import {
  createManualAnalysis,
  formToCreateInput,
  updateAnalysisData,
} from "@/lib/analysis-service";
import { createAnalysis, deleteAnalysis, getAnalysis, saveThesis } from "@/lib/db/repository";
import {
  analysisCoreSchema,
  fieldErrors,
  financialYearsSchema,
  manualAnalysisSchema,
  thesisSchema,
} from "@/lib/validation/schemas";

export type ActionState<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function toFailure(error: unknown): ActionState<never> {
  if (error instanceof z.ZodError) {
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: fieldErrors(error) };
  }
  if (error instanceof AppError) {
    return { ok: false, message: error.message };
  }
  return {
    ok: false,
    message: "Something went wrong while saving. Please try again.",
  };
}

const newAnalysisPayload = z.object({
  origin: z.enum(["manual", "import"]),
  data: z.unknown(),
});

export async function saveNewAnalysisAction(
  payload: unknown,
): Promise<ActionState<{ id: string }>> {
  try {
    const { db, workspaceId } = await getWorkspaceContext();
    if (!canWrite(workspaceId)) {
      return { ok: false, message: "This workspace is read-only." };
    }
    const { origin, data } = newAnalysisPayload.parse(payload);
    const parsed = manualAnalysisSchema.parse(data);

    if (origin === "manual") {
      const record = await createManualAnalysis(db, parsed, workspaceId);
      return { ok: true, data: { id: record.id } };
    }
    const { analysis, statements } = formToCreateInput(parsed, workspaceId, {
      origin: "import",
      isDemo: false,
    });
    const record = await createAnalysis(db, analysis, statements);
    return { ok: true, data: { id: record.id } };
  } catch (error) {
    return toFailure(error);
  }
}

const removedYearsSchema = z.array(z.number().int()).max(5).optional();

export async function updateAnalysisAction(
  payload: unknown,
): Promise<ActionState<{ id: string }>> {
  try {
    const { db, workspaceId } = await getWorkspaceContext();
    if (!canWrite(workspaceId)) {
      return { ok: false, message: "This workspace is read-only." };
    }
    const envelope = z
      .object({
        id: z.string().min(1),
        fields: analysisCoreSchema.partial().optional(),
        years: financialYearsSchema.optional(),
        removedYears: removedYearsSchema,
        replaceStatements: z.boolean().optional(),
      })
      .parse(payload);

    const existing = await getAnalysis(db, envelope.id, workspaceId);
    if (!existing) {
      return { ok: false, message: "That analysis could not be found." };
    }

    const result = await updateAnalysisData(db, envelope.id, workspaceId, {
      fields: envelope.fields,
      statements: envelope.years,
      removedYears: envelope.removedYears,
      replaceStatements: envelope.replaceStatements,
    });
    if (!result) return { ok: false, message: "That analysis could not be updated." };
    return { ok: true, data: { id: result.analysis.id } };
  } catch (error) {
    return toFailure(error);
  }
}

export async function saveThesisAction(payload: unknown): Promise<ActionState<{ id: string }>> {
  try {
    const { db, workspaceId } = await getWorkspaceContext();
    if (!canWrite(workspaceId)) {
      return { ok: false, message: "This workspace is read-only." };
    }
    const envelope = z
      .object({ id: z.string().min(1), thesis: z.unknown() })
      .parse(payload);
    const thesis = thesisSchema.parse(envelope.thesis);

    const existing = await getAnalysis(db, envelope.id, workspaceId);
    if (!existing) return { ok: false, message: "That analysis could not be found." };

    const saved = await saveThesis(db, envelope.id, workspaceId, {
      recommendation: thesis.recommendation ?? null,
      targetPrice: thesis.targetPrice ?? null,
      summary: thesis.summary,
      catalysts: thesis.catalysts,
      risks: thesis.risks,
    });
    if (!saved) return { ok: false, message: "The thesis could not be saved." };
    return { ok: true, data: { id: envelope.id } };
  } catch (error) {
    return toFailure(error);
  }
}

export async function deleteAnalysisAction(payload: unknown): Promise<ActionState<{ id: string }>> {
  try {
    const { db, workspaceId } = await getWorkspaceContext();
    if (!canWrite(workspaceId)) return { ok: false, message: "This workspace is read-only." };
    const { id } = z.object({ id: z.string().min(1) }).parse(payload);
    const deleted = await deleteAnalysis(db, id, workspaceId);
    if (!deleted) return { ok: false, message: "That analysis could not be deleted." };
    return { ok: true, data: { id } };
  } catch (error) {
    return toFailure(error);
  }
}