import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { RecommendationBadge } from "@/components/recommendation-badge";
import { computeAnalysisMetrics } from "@/lib/analysis-service";
import type { AnalysisSummary } from "@/lib/db/repository";
import { asPercent, formatDate, formatMetric, formatMoney, metricPlaceholder } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AnalysisSummaryCard({ summary }: { summary: AnalysisSummary }) {
  const { analysis, latestStatement, recommendation, targetPrice } = summary;
  const metrics = computeAnalysisMetrics(
    analysis,
    latestStatement ? [latestStatement] : [],
    targetPrice,
  );
  const currency = analysis.reportingCurrency;
  const quoteCurrency = analysis.quoteCurrency ?? currency;
  const industry = analysis.industry ?? analysis.sector ?? "Industry not set";
  const latestFyLabel = metrics.latestFiscalYear
    ? `Latest FY revenue · FY${metrics.latestFiscalYear}`
    : "Latest FY revenue";
  const evDisplay =
    metrics.currencyMismatch && metrics.enterpriseValue.status === "na"
      ? metricPlaceholder(metrics.enterpriseValue.reason)
      : formatMetric(metrics.enterpriseValue, (value) => formatMoney(value, quoteCurrency));

  return (
    <Card className="gap-3">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">
              <Link
                href={`/analysis/${analysis.id}`}
                className="hover:text-primary hover:underline"
              >
                {analysis.companyName}
              </Link>
            </CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <span className="font-mono font-medium">{analysis.ticker}</span>
              <span aria-hidden> · </span>
              <span className="truncate">{industry}</span>
            </p>
          </div>
          <RecommendationBadge recommendation={recommendation} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Metric label={latestFyLabel} value={formatMoney(metrics.latestRevenue, currency)} />
          <Metric label="Enterprise value" value={evDisplay} />
          <Metric
            label="EBITDA margin"
            value={formatMetric(metrics.ebitdaMargin, asPercent)}
          />
          <Metric label="Reporting currency" value={currency} />
          <Metric label="Last updated" value={formatDate(analysis.updatedAt)} />
          <Metric
            label="Source"
            value={analysis.isDemo ? "Synthetic demo data" : (analysis.source ?? "—")}
          />
        </dl>
        <div className="flex flex-wrap gap-2">
          <Link href={`/analysis/${analysis.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Open analysis
          </Link>
          {analysis.isDemo ? (
            <span className="self-center text-xs text-muted-foreground">Read-only demo</span>
          ) : (
            <Link href={`/analysis/${analysis.id}/edit`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Edit
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs leading-snug text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular-nums">{value}</dd>
    </div>
  );
}