"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchResponse } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

const PROVIDER_LABELS: Record<string, string> = {
  alpha_vantage: "Alpha Vantage",
  sec: "SEC EDGAR",
  demo: "Synthetic demo",
};

function providerBadgeVariant(provider: string) {
  if (provider === "demo") return "outline" as const;
  return "secondary" as const;
}

export function CompanySearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [lastQuery, setLastQuery] = useState<string | null>(null);

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setError("Enter a ticker or company name to search.");
      setResponse(null);
      return;
    }
    setLoading(true);
    setError(null);
    setLastQuery(trimmed);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        headers: { Accept: "application/json" },
      });
      const body = (await res.json()) as SearchResponse & { error?: { message?: string } };
      if (!res.ok) {
        setError(body.error?.message ?? "Search failed. Please try again.");
        setResponse(null);
      } else {
        setResponse(body);
      }
    } catch {
      setError("Could not reach the search service. Check your connection and try again.");
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }

  function selectResult(provider: string, symbol: string) {
    router.push(`/new/import?provider=${encodeURIComponent(provider)}&symbol=${encodeURIComponent(symbol)}`);
  }

  const noMatches = response && response.results.length === 0;

  return (
    <div className="space-y-4">
      <form onSubmit={runSearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="company-search">Ticker or company name</Label>
          <Input
            id="company-search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. AAPL, Microsoft, HELIO"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="company-search-help"
          />
          <p id="company-search-help" className="text-xs text-muted-foreground">
            Searches run only when you submit, never on each keystroke.
          </p>
        </div>
        <Button type="submit" disabled={loading} className="sm:mb-6">
          <Search className="size-4" aria-hidden />
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Search problem</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {response && response.warnings.length > 0 ? (
        <Alert>
          <AlertTitle>Some providers were unavailable</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-5">
              {response.warnings.map((warning, index) => (
                <li key={`${warning.code}-${index}`}>{warning.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="space-y-2" aria-live="polite">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : null}

      {noMatches && !loading ? (
        <Alert>
          <AlertTitle>No matches for “{lastQuery}”</AlertTitle>
          <AlertDescription>
            Check the spelling, try the full company name, or create the company manually.
          </AlertDescription>
        </Alert>
      ) : null}

      {response && response.results.length > 0 ? (
        <ul className="space-y-2" aria-label="Search results">
          {response.results.map((result) => (
            <li key={`${result.provider}-${result.symbol}`}>
              <Card
                size="sm"
                className="transition-colors hover:border-primary/50"
                role="button"
                tabIndex={0}
                onClick={() => selectResult(result.provider, result.symbol)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectResult(result.provider, result.symbol);
                  }
                }}
              >
                <CardContent className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{result.name}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="font-mono font-medium text-foreground">{result.symbol}</span>
                      {result.exchange ? <span>{result.exchange}</span> : null}
                      {result.region ? <span>{result.region}</span> : null}
                      {result.country ? <span>{result.country}</span> : null}
                      {result.securityType ? <span>{result.securityType}</span> : null}
                      {result.currency ? <span>{result.currency}</span> : null}
                    </p>
                  </div>
                  <Badge variant={providerBadgeVariant(result.provider)} title={`Data source: ${result.dataSource}`}>
                    {PROVIDER_LABELS[result.provider] ?? result.dataSource}
                  </Badge>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {response ? (
        <p className={cn("text-xs text-muted-foreground")}>
          {response.results.length} result{response.results.length === 1 ? "" : "s"} from{" "}
          {response.providers.length > 0 ? response.providers.join(", ") : "no providers"}.
        </p>
      ) : null}
    </div>
  );
}