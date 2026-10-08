import Link from "next/link";
import { notFound } from "next/navigation";
import { ThesisEditor } from "@/components/thesis-editor";
import { buttonVariants } from "@/components/ui/button";
import { getWorkspaceContext } from "@/lib/server-context";
import { getAnalysis } from "@/lib/db/repository";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ThesisPage(props: PageProps<"/analysis/[id]/thesis">) {
  const { id } = await props.params;
  const { db, workspaceId } = await getWorkspaceContext();
  const data = await getAnalysis(db, id, workspaceId);
  if (!data) notFound();

  const { analysis, thesis } = data;
  const quoteCurrency = analysis.quoteCurrency ?? analysis.reportingCurrency;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-heading text-2xl font-semibold">Investment thesis</h1>
          <Link
            href={`/analysis/${analysis.id}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Back to analysis
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          {analysis.companyName} · <span className="font-mono">{analysis.ticker}</span>
        </p>
      </header>

      <ThesisEditor
        analysisId={analysis.id}
        currentPrice={analysis.sharePrice}
        quoteCurrency={quoteCurrency}
        initial={{
          recommendation: thesis?.recommendation ?? null,
          targetPrice: thesis?.targetPrice === null || thesis?.targetPrice === undefined ? "" : String(thesis.targetPrice),
          summary: thesis?.summary ?? "",
          catalysts: thesis?.catalysts ?? [],
          risks: thesis?.risks ?? [],
        }}
      />
    </div>
  );
}