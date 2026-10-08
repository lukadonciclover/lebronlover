import Link from "next/link";
import { notFound } from "next/navigation";
import { FinancialsForm } from "@/components/financials-form";
import { draftToFormValue } from "@/lib/form-values";
import { getWorkspaceContext } from "@/lib/server-context";
import { importCompany } from "@/lib/providers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ImportReviewPage(props: PageProps<"/new/import">) {
  const searchParams = await props.searchParams;
  const provider = typeof searchParams.provider === "string" ? searchParams.provider : "";
  const symbol = typeof searchParams.symbol === "string" ? searchParams.symbol : "";
  if (!provider || !symbol) notFound();

  const { db } = await getWorkspaceContext();
  const outcome = await importCompany(db, provider, symbol);

  if (outcome.ok) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold">Import review</h1>
          <p className="text-sm text-muted-foreground">
            Check and adjust the imported values before saving. Nothing is stored until you save.
          </p>
        </header>
        <FinancialsForm
          mode="import"
          initial={draftToFormValue(outcome.draft)}
          cancelHref="/new/search"
          submitLabel="Save imported analysis"
        />
      </div>
    );
  }

  const manualParams = new URLSearchParams();
  if (outcome.cached) {
    manualParams.set("name", outcome.cached.identity.name);
    manualParams.set("ticker", outcome.cached.identity.ticker);
  }
  const manualHref = `/new/manual${manualParams.size > 0 ? `?${manualParams.toString()}` : ""}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Import review</h1>
        <p className="text-sm text-muted-foreground">
          The provider could not be reached for {symbol.toUpperCase()}.
        </p>
      </header>

      <Alert variant="destructive">
        <AlertTitle>Import failed</AlertTitle>
        <AlertDescription>{outcome.error.message}</AlertDescription>
      </Alert>

      {outcome.cached ? (
        <Card>
          <CardHeader>
            <CardTitle>Use cached data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A previous import for {outcome.cached.identity.name} is available. It was retrieved{" "}
              {outcome.cached.retrievalDate.slice(0, 16).replace("T", " ")} UTC. Cached data may not
              reflect the latest figures.
            </p>
            <FinancialsForm
              mode="import"
              initial={draftToFormValue(outcome.cached)}
              cancelHref="/new/search"
              submitLabel="Save cached analysis"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Next steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Your selected company has been kept. You can search again, or continue with manual
              entry for the same company.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href={manualHref} className={cn(buttonVariants({}))}>
                Enter financials manually
              </Link>
              <Link href="/new/search" className={cn(buttonVariants({ variant: "outline" }))}>
                Back to search
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}