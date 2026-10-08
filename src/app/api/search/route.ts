import { NextResponse, type NextRequest } from "next/server";
import { getWorkspaceContext } from "@/lib/server-context";
import { searchCompanies } from "@/lib/providers";
import { searchQuerySchema } from "@/lib/validation/schemas";
import { toErrorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get("q") ?? "";
    const query = searchQuerySchema.parse(raw);
    const { db } = await getWorkspaceContext();
    const response = await searchCompanies(db, query);
    return NextResponse.json(response);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}