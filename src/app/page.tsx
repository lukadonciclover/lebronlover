import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { AnalysisSummaryCard } from "@/components/analysis-summary-card";
import { getWorkspaceContext } from "@/lib/server-context";
import { getDashboardData } from "@/lib/analysis-service";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MONEY_UNIT_NOTE } from "@/lib/constants";

export const dynamic = "force-dynamic";

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const { db, workspaceId } = await getWorkspaceContext();
  const data = await getDashboardData(db, workspaceId);
  const { coverages, recommendationCounts, totalsByCurrency } = data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {coverages.length === 0
              ? "Your equity research workspace."
              : `Covering ${coverages.length} ${coverages.length === 1 ? "company" : "companies"}.`}
          </p>
        </div>
        <Link href="/new" className={cn(buttonVariants({ size: "lg" }))}>
          New analysis
        </Link>
      </header>

      {coverages.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Companies covered" value={coverages.length} />
            <StatCard label="Buy" value={recommendationCounts.buy} hint="Rated analyses only" />
            <StatCard label="Hold" value={recommendationCounts.hold} hint="Rated analyses only" />
            <StatCard label="Sell" value={recommendationCounts.sell} hint="Rated analyses only" />
          </section>

          {totalsByCurrency.length > 0 ? (
            <Card size="sm">
              <CardHeader>
                <CardTitle className="text-sm">Combined market capitalisation by currency</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {totalsByCurrency.map((total) => (
                  <div key={total.currency} className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {total.currency} · {total.count} {total.count === 1 ? "company" : "companies"}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatMoney(total.marketCap, total.currency)}
                    </span>
                  </div>
                ))}
                <p className="pt-1 text-xs text-muted-foreground">
                  Totals are never summed across currencies without a documented FX conversion.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {recommendationCounts.unrated > 0 ? (
            <p className="text-xs text-muted-foreground">
              {recommendationCounts.unrated} {recommendationCounts.unrated === 1 ? "analysis has" : "analyses have"} no
              saved recommendation yet, so {recommendationCounts.unrated === 1 ? "it is" : "they are"} not counted above.
            </p>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-2">
            {coverages.map((summary) => (
              <AnalysisSummaryCard key={summary.analysis.id} summary={summary} />
            ))}
          </section>
          <p className="text-xs text-muted-foreground">{MONEY_UNIT_NOTE}</p>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Start your first equity research analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          The workflow is simple: search for a company and import its financials, or enter the
          figures yourself. Review the data, read the performance and valuation metrics, then write
          your investment thesis and save it to revisit later.
        </p>
        <ol className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <li className="rounded-lg border p-3">
            <span className="font-medium text-foreground">1. Find a company</span>
            <p>Search by ticker or name, or create one manually.</p>
          </li>
          <li className="rounded-lg border p-3">
            <span className="font-medium text-foreground">2. Review financials</span>
            <p>Adjust up to five years of annual statements before saving.</p>
          </li>
          <li className="rounded-lg border p-3">
            <span className="font-medium text-foreground">3. Analyse</span>
            <p>Margins, growth, EV/EBITDA, P/E and more, with charts.</p>
          </li>
          <li className="rounded-lg border p-3">
            <span className="font-medium text-foreground">4. Pitch</span>
            <p>Write your thesis, catalysts, risks and rating.</p>
          </li>
        </ol>
        <div className="flex flex-wrap gap-3">
          <Link href="/new" className={cn(buttonVariants({}))}>
            New analysis
          </Link>
          <Link href="/new/manual" className={cn(buttonVariants({ variant: "outline" }))}>
            Enter financials manually
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          No API keys are required: manual entry works out of the box, and clearly labelled
          synthetic demo data is available for practice.
        </p>
      </CardContent>
    </Card>
  );
}