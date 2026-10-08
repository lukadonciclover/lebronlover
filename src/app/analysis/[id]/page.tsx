import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecommendationBadge } from "@/components/recommendation-badge";
import { FinancialTable } from "@/components/financial-table";
import { EbitdaFcfChart, RevenueChart, type ChartPoint } from "@/components/financial-charts";
import { getWorkspaceContext } from "@/lib/server-context";
import { getAnalysis } from "@/lib/db/repository";
import { computeAnalysisMetrics } from "@/lib/analysis-service";
import { resolveEbitda, resolveFreeCashFlow } from "@/lib/finance/metrics";
import {
  asMultiple,
  asPercent,
  formatDate,
  formatMetric,
  formatMoney,
  formatNumber,
} from "@/lib/format";
import { MONEY_UNIT_NOTE, type Recommendation } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { MetricResult } from "@/lib/finance/calculations";

export const dynamic = "force-dynamic";

function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "muted";
}) {
  return (
    <div className={cn("rounded-lg border p-3", tone === "muted" && "bg-muted/30")}>
      <p className="text-xs leading-snug text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ratioTone(result: MetricResult): "default" | "muted" {
  return result.status === "ok" ? "default" : "muted";
}

export default async function AnalysisPage(props: PageProps<"/analysis/[id]">) {
  const { id } = await props.params;
  const { db, workspaceId } = await getWorkspaceContext();
  const data = await getAnalysis(db, id, workspaceId);
  if (!data) notFound();

  const { analysis, statements, thesis } = data;
  const recommendation: Recommendation | null = thesis?.recommendation ?? null;
  const targetPrice = thesis?.targetPrice ?? null;
  const metrics = computeAnalysisMetrics(analysis, statements, targetPrice);
  const currency = analysis.reportingCurrency;
  const quoteCurrency = analysis.quoteCurrency ?? currency;

  const latestLabel = metrics.latestFiscalYear
    ? `Latest FY revenue · FY${metrics.latestFiscalYear}`
    : "Latest FY revenue";

  const chartData: ChartPoint[] = [...statements]
    .sort((a, b) => a.fiscalYear - b.fiscalYear)
    .map((statement) => ({
      fiscalYear: statement.fiscalYear,
      revenue: statement.revenue,
      ebitda: resolveEbitda(statement).value,
      freeCashFlow: resolveFreeCashFlow(statement).value,
    }));

  const netDebtText = (() => {
    if (metrics.netDebt.status !== "ok") return formatMetric(metrics.netDebt, (v) => formatMoney(v, currency));
    if (metrics.netCash) return `Net cash ${formatMoney(Math.abs(metrics.netDebt.value), currency)}`;
    return formatMoney(metrics.netDebt.value, currency);
  })();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold">{analysis.companyName}</h1>
            <RecommendationBadge recommendation={recommendation} />
            {analysis.isDemo ? <Badge variant="outline">Synthetic demo data</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{analysis.ticker}</span>
            {analysis.exchange ? ` · ${analysis.exchange}` : ""}
            {analysis.industry ? ` · ${analysis.industry}` : ""}
            {analysis.country ? ` · ${analysis.country}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {analysis.isDemo ? (
            <span className="self-center text-xs text-muted-foreground">Read-only demo record</span>
          ) : (
            <>
              <Link href={`/analysis/${analysis.id}/edit`} className={cn(buttonVariants({ variant: "outline" }))}>
                Edit data
              </Link>
              <Link href={`/analysis/${analysis.id}/thesis`} className={cn(buttonVariants({}))}>
                {thesis ? "Edit thesis" : "Build thesis"}
              </Link>
            </>
          )}
        </div>
      </header>

      {analysis.description ? (
        <p className="max-w-3xl text-sm text-muted-foreground">{analysis.description}</p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Valuation snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <MetricCard
              label={`Share price${analysis.quoteDate ? ` (${formatDate(analysis.quoteDate)})` : ""}`}
              value={
                analysis.sharePrice === null
                  ? "N/A"
                  : `${quoteCurrency} ${formatNumber(analysis.sharePrice, 2)}`
              }
            />
            <MetricCard label="Market cap" value={formatMetric(metrics.marketCap, (v) => formatMoney(v, quoteCurrency))} />
            <MetricCard
              label="Enterprise value"
              value={formatMetric(metrics.enterpriseValue, (v) => formatMoney(v, quoteCurrency))}
            />
            <MetricCard label={metrics.netCash ? "Net cash" : "Net debt"} value={netDebtText} />
          </CardContent>
        </Card>

        <Card size="sm" className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Recommendation</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricCard label="Rating" value={recommendation ?? "Not rated"} />
            <MetricCard
              label="Target price"
              value={targetPrice === null ? "N/A" : `${quoteCurrency} ${formatNumber(targetPrice, 2)}`}
            />
            <MetricCard
              label="Implied upside/downside"
              value={formatMetric(metrics.impliedUpside, asPercent)}
              hint={targetPrice === null ? "No target price set" : undefined}
            />
          </CardContent>
        </Card>
      </section>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm">Reporting currency & units</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Financial statements are reported in <strong className="text-foreground">{currency}</strong>.
            {" "}Share prices and valuation multiples that cross currencies use{" "}
            <strong className="text-foreground">{quoteCurrency}</strong>.
          </p>
          <p className="mt-1">{MONEY_UNIT_NOTE}</p>
          {metrics.currencyMismatch ? (
            <p className="mt-1 text-amber-700">
              Reporting and quote currencies differ. Cross-currency metrics show N/A until an explicit
              FX rate is supplied on the edit page — no rate is assumed.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 font-heading text-lg font-medium">Performance & valuation</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <MetricCard label={latestLabel} value={formatMoney(metrics.latestRevenue, currency)} />
          <MetricCard label="Revenue growth (latest YoY)" value={formatMetric(metrics.revenueGrowth, asPercent)} />
          <MetricCard
            label="Revenue CAGR"
            value={formatMetric(metrics.revenueCagr, asPercent)}
            hint={
              metrics.years > 0 ? `Over ${metrics.years} elapsed fiscal year${metrics.years === 1 ? "" : "s"}` : "Needs 2+ years"
            }
          />
          <MetricCard label="Gross margin" value={formatMetric(metrics.grossMargin, asPercent)} tone={ratioTone(metrics.grossMargin)} />
          <MetricCard label="EBITDA margin" value={formatMetric(metrics.ebitdaMargin, asPercent)} tone={ratioTone(metrics.ebitdaMargin)} />
          <MetricCard label="Operating margin" value={formatMetric(metrics.operatingMargin, asPercent)} tone={ratioTone(metrics.operatingMargin)} />
          <MetricCard label="Net margin" value={formatMetric(metrics.netMargin, asPercent)} tone={ratioTone(metrics.netMargin)} />
          <MetricCard label="FCF margin" value={formatMetric(metrics.fcfMargin, asPercent)} tone={ratioTone(metrics.fcfMargin)} />
          <MetricCard label="EV / Revenue" value={formatMetric(metrics.evToRevenue, asMultiple)} tone={ratioTone(metrics.evToRevenue)} />
          <MetricCard label="EV / EBITDA" value={formatMetric(metrics.evToEbitda, asMultiple)} tone={ratioTone(metrics.evToEbitda)} />
          <MetricCard label="P / E" value={formatMetric(metrics.peRatio, asMultiple)} tone={ratioTone(metrics.peRatio)} />
          <MetricCard label="FCF yield" value={formatMetric(metrics.fcfYield, asPercent)} tone={ratioTone(metrics.fcfYield)} />
          <MetricCard
            label="Return on equity"
            value={formatMetric(metrics.returnOnEquity, asPercent)}
            tone={ratioTone(metrics.returnOnEquity)}
            hint="Net income ÷ average equity"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          “Not meaningful” is shown when a negative earnings or EBITDA figure makes a conventional
          valuation interpretation misleading.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Revenue by fiscal year ({currency} m)</CardTitle>
          </CardHeader>
          <CardContent>
            {statements.some((statement) => statement.revenue !== null) ? (
              <RevenueChart data={chartData} currency={currency} />
            ) : (
              <EmptyChart message="No revenue data available for a chart." />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">EBITDA & free cash flow ({currency} m)</CardTitle>
          </CardHeader>
          <CardContent>
            {statements.some((statement) => resolveEbitda(statement).value !== null || resolveFreeCashFlow(statement).value !== null) ? (
              <EbitdaFcfChart data={chartData} currency={currency} />
            ) : (
              <EmptyChart message="No EBITDA or free cash flow data available for a chart." />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-medium">Historical financials</h2>
        <FinancialTable statements={statements} currency={currency} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Investment case</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {thesis ? (
              <>
                {thesis.summary ? <p className="whitespace-pre-line">{thesis.summary}</p> : <p className="text-muted-foreground">No thesis summary yet.</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Catalysts</h3>
                    {thesis.catalysts.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-5">
                        {thesis.catalysts.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">None listed.</p>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risks</h3>
                    {thesis.risks.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-5">
                        {thesis.risks.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">None listed.</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Thesis last updated {formatDate(thesis.updatedAt)}.</p>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  No investment thesis saved yet. Write your summary, catalysts, risks and rating.
                </p>
                <Link href={`/analysis/${analysis.id}/thesis`} className={cn(buttonVariants({ size: "sm" }))}>
                  Build thesis
                </Link>
              </div>
            )}
            {thesis ? (
              <p className="text-xs text-muted-foreground">
                Implied upside uses the target price {targetPrice === null ? "(not set)" : `${quoteCurrency} ${formatNumber(targetPrice, 2)}`} against the current share price.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Data provenance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Source: {analysis.isDemo ? "Synthetic demo data" : (analysis.source ?? "—")}</p>
            <p>Retrieved: {formatDate(analysis.retrievalDate)}</p>
            <p>Last updated: {formatDate(analysis.updatedAt)}</p>
            {analysis.cashDate || analysis.debtDate ? (
              <p>
                Valuation uses cash as of {formatDate(analysis.cashDate)} and debt as of{" "}
                {formatDate(analysis.debtDate)}, separate from historical balance-sheet values.
              </p>
            ) : null}
            {analysis.sourceUrl ? (
              <p className="break-all">
                <a href={analysis.sourceUrl} className="text-primary underline" rel="noreferrer noopener" target="_blank">
                  View source
                </a>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  );
}