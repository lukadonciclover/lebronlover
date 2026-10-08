import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PencilLine, Search } from "lucide-react";
import { availableProviders } from "@/lib/providers";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default function NewAnalysisPage() {
  const providers = availableProviders();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">New analysis</h1>
        <p className="text-sm text-muted-foreground">
          Choose how you would like to start. You can switch methods at any time without losing your
          place.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <Search className="size-6 text-primary" aria-hidden />
            <CardTitle className="mt-2">Import company financials</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Search by ticker or company name, then review up to five years of annual statements
              before saving.
            </p>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {providers.length > 0 ? (
                  providers.map((provider) => (
                    <Badge key={provider.id} variant="secondary">
                      {provider.label}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline">No providers configured</Badge>
                )}
              </div>
              <Link href="/new/search" className={cn(buttonVariants({}), "w-full")}>
                Search companies
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <PencilLine className="size-6 text-primary" aria-hidden />
            <CardTitle className="mt-2">Enter financials manually</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              A guided form for company details, valuation inputs and three or more years of annual
              history. Works with no API keys.
            </p>
            <Link
              href="/new/manual"
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              Start manual entry
            </Link>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Provider credentials stay on the server. If a provider is unavailable or its quota is
        exhausted, your selected company is preserved and you can continue with manual entry.
      </p>
    </div>
  );
}