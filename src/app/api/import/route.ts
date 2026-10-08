import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/server-context";
import { importCompany } from "@/lib/providers";
import { toErrorResponse } from "@/lib/errors";

const paramsSchema = z.object({
  provider: z.string().trim().min(1),
  symbol: z.string().trim().min(1).max(24),
});

export async function GET(request: NextRequest) {
  try {
    const params = paramsSchema.parse({
      provider: request.nextUrl.searchParams.get("provider") ?? "",
      symbol: request.nextUrl.searchParams.get("symbol") ?? "",
    });
    const { db } = await getWorkspaceContext();
    const outcome = await importCompany(db, params.provider, params.symbol);
    return NextResponse.json(outcome);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}