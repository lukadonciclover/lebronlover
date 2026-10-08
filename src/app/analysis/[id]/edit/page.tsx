import { notFound } from "next/navigation";
import { FinancialsForm } from "@/components/financials-form";
import { recordToFormValue } from "@/lib/form-values";
import { getWorkspaceContext } from "@/lib/server-context";
import { getAnalysis } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export default async function EditAnalysisPage(props: PageProps<"/analysis/[id]/edit">) {
  const { id } = await props.params;
  const { db, workspaceId } = await getWorkspaceContext();
  const data = await getAnalysis(db, id, workspaceId);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Edit financial data</h1>
        <p className="text-sm text-muted-foreground">
          {data.analysis.companyName} · <span className="font-mono">{data.analysis.ticker}</span>
        </p>
      </header>
      <FinancialsForm
        mode="edit"
        analysisId={data.analysis.id}
        initial={recordToFormValue(data.analysis, data.statements)}
        cancelHref={`/analysis/${data.analysis.id}`}
        submitLabel="Save financial data"
      />
    </div>
  );
}