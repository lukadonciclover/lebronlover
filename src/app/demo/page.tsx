import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { AnalysisSummaryCard } from "@/components/analysis-summary-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getWorkspaceContext } from "@/lib/server-context";
import { getDashboardData } from "@/lib/analysis-service";
import { ensureDemoSeed } from "@/lib/demo-seed";
import { DEMO_WORKSPACE_ID } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const { db } = await getWorkspaceContext();
  await ensureDemoSeed(db);
  const data = await getDashboardData(db, DEMO_WORKSPACE_ID);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Demo workspace</h1>
        <p className="text-sm text-muted-foreground">
          A shared, read-only set of example analyses. Your own analyses stay private to your
          workspace.
        </p>
      </header>

      <Alert>
        <AlertTitle>Synthetic demo data</AlertTitle>
        <AlertDescription>
          Every figure here is fabricated for demonstration and is not attributed to any real
          company. These records cannot be edited.
        </AlertDescription>
      </Alert>

      {data.coverages.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No demo records yet</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/new" className={cn(buttonVariants({}))}>
              Create an analysis
            </Link>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {data.coverages.map((summary) => (
            <AnalysisSummaryCard key={summary.analysis.id} summary={summary} />
          ))}
        </section>
      )}
    </div>
  );
}