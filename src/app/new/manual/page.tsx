import { FinancialsForm } from "@/components/financials-form";
import { manualDefaults } from "@/lib/form-values";

export const dynamic = "force-dynamic";

export default async function ManualEntryPage(props: PageProps<"/new/manual">) {
  const searchParams = await props.searchParams;
  const companyName = typeof searchParams.name === "string" ? searchParams.name : undefined;
  const ticker = typeof searchParams.ticker === "string" ? searchParams.ticker : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Enter financials manually</h1>
        <p className="text-sm text-muted-foreground">
          A guided two-step form. Monetary values are in millions of the reporting currency. You do
          not need to fill every field — blanks are saved as unavailable, distinct from zero.
        </p>
      </header>
      <FinancialsForm
        mode="manual"
        initial={manualDefaults({ companyName, ticker })}
        cancelHref="/new"
      />
    </div>
  );
}