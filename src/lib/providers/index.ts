import type { Db } from "@/lib/db/client";
import { ProviderError, plainLanguageFor } from "@/lib/errors";
import { normalizeStatements } from "@/lib/finance/normalize";
import type {
  CompanyDraft,
  CompanySearchResult,
  NormalizedAnnualStatement,
  ProviderWarning,
  SearchResponse,
} from "@/lib/finance/types";
import type { ProviderId } from "@/lib/constants";
import { AlphaVantageAdapter } from "@/lib/providers/alpha-vantage";
import { DemoAdapter } from "@/lib/providers/mock";
import { SecAdapter } from "@/lib/providers/sec";
import { buildCacheKey, cachedFetch, readStale } from "@/lib/providers/cache";
import type {
  ProviderAdapter,
  ProviderProfile,
  ProviderQuote,
  ProviderStatements,
} from "@/lib/providers/types";

export function getAdapters(): ProviderAdapter[] {
  const adapters: ProviderAdapter[] = [];
  const alphaVantage = new AlphaVantageAdapter();
  const sec = new SecAdapter();
  const demo = new DemoAdapter();
  if (alphaVantage.isConfigured()) adapters.push(alphaVantage);
  if (sec.isConfigured()) adapters.push(sec);
  if (demo.isConfigured()) adapters.push(demo);
  return adapters;
}

export function getAdapter(id: string): ProviderAdapter | undefined {
  return getAdapters().find((adapter) => adapter.id === id);
}

export function availableProviders(): { id: ProviderId; label: string }[] {
  return getAdapters().map((adapter) => ({ id: adapter.id, label: adapter.label }));
}

function warningFromError(error: unknown, scope: ProviderWarning["scope"]): ProviderWarning {
  const providerError = ProviderError.from(error);
  return { code: providerError.code, message: providerError.message, scope };
}

export async function searchCompanies(db: Db, query: string): Promise<SearchResponse> {
  const adapters = getAdapters();
  const warnings: ProviderWarning[] = [];
  const results: CompanySearchResult[] = [];

  const settled = await Promise.allSettled(
    adapters.map(async (adapter) => {
      const key = buildCacheKey(adapter.id, "search", { q: query.trim().toLowerCase() });
      const cached = await cachedFetch<CompanySearchResult[]>({
        db,
        provider: adapter.id,
        kind: "search",
        key,
        fetcher: () => adapter.search(query),
      });
      return cached.value;
    }),
  );

  settled.forEach((outcome) => {
    if (outcome.status === "fulfilled") {
      results.push(...outcome.value);
    } else {
      warnings.push(warningFromError(outcome.reason, "general"));
    }
  });

  if (adapters.length === 0) {
    warnings.push({
      code: "not_configured",
      message:
        "No data provider is configured. You can still create analyses using manual entry.",
      scope: "general",
    });
  }

  const seen = new Set<string>();
  const deduped = results.filter((result) => {
    const key = `${result.provider}:${result.symbol.toUpperCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const sorted = deduped.sort((a, b) => {
    if ((a.rank ?? 100) !== (b.rank ?? 100)) return (a.rank ?? 100) - (b.rank ?? 100);
    return a.name.localeCompare(b.name);
  });

  return { query, results: sorted, warnings, providers: adapters.map((a) => a.id) };
}

function normalizeImportedStatements(
  statements: ProviderStatements,
  retrievedAt: string,
  reportingCurrency: string | null,
): NormalizedAnnualStatement[] {
  return normalizeStatements(statements.statements).map((statement) => ({
    ...statement,
    source: statements.source,
    sourceUrl: statements.sourceUrl ?? null,
    retrievalDate: retrievedAt,
    originalCurrency: statement.originalCurrency ?? reportingCurrency,
    manual: false,
  }));
}

function assembleDraft(input: {
  provider: ProviderId;
  profile: ProviderProfile;
  statements: ProviderStatements;
  statementsRetrievedAt: string;
  quote: ProviderQuote | null;
  warnings: ProviderWarning[];
  isDemo?: boolean;
}): CompanyDraft {
  const { provider, profile, statements, quote, warnings } = input;
  const reportingCurrency =
    profile.reportingCurrency ?? statements.currency ?? quote?.currency ?? "USD";
  const quoteCurrency = profile.quoteCurrency ?? quote?.currency ?? reportingCurrency;
  const normalized = normalizeImportedStatements(
    statements,
    input.statementsRetrievedAt,
    reportingCurrency,
  );
  const latest = normalized.at(-1) ?? null;

  return {
    provider,
    identity: {
      ...profile.identity,
      // Prefer the reporting currency we resolved; identity has no currency.
    },
    market: {
      reportingCurrency,
      quoteCurrency,
      sharePrice: quote?.price ?? null,
      quoteDate: quote?.quoteDate ?? null,
      sharesOutstanding: quote?.sharesOutstanding ?? null,
      sharesOutstandingDate: quote?.sharesOutstandingDate ?? null,
      marketCap: quote?.marketCap ?? null,
      marketCapDate: quote?.marketCapDate ?? null,
    },
    valuation: {
      cash: latest?.cashAndEquivalents ?? null,
      cashDate: latest?.periodEnd ?? null,
      totalDebt: latest?.totalDebt ?? null,
      debtDate: latest?.periodEnd ?? null,
    },
    statements: normalized,
    warnings,
    source: profile.source || statements.source,
    sourceUrl: profile.sourceUrl ?? statements.sourceUrl ?? null,
    retrievalDate: input.statementsRetrievedAt,
    isDemo: input.isDemo ?? provider === "demo",
  };
}

async function readStaleDraft(
  db: Db,
  provider: ProviderAdapter,
  symbol: string,
): Promise<CompanyDraft | null> {
  const profileKey = buildCacheKey(provider.id, "profile", { symbol });
  const statementsKey = buildCacheKey(provider.id, "statements", { symbol });
  const quoteKey = buildCacheKey(provider.id, "quote", { symbol });
  const [profile, statements, quote] = await Promise.all([
    readStale<ProviderProfile>(db, profileKey),
    readStale<ProviderStatements>(db, statementsKey),
    readStale<ProviderQuote | null>(db, quoteKey),
  ]);
  if (!profile || !statements) return null;
  return assembleDraft({
    provider: provider.id,
    profile: profile.value,
    statements: statements.value,
    statementsRetrievedAt: statements.retrievedAt,
    quote: quote?.value ?? null,
    warnings: [
      {
        code: "stale_cache",
        message: `Live data was unavailable. Showing cached data retrieved ${statements.retrievedAt}.`,
        scope: "general",
      },
    ],
    isDemo: provider.id === "demo",
  });
}

export type ImportOutcome =
  | { ok: true; draft: CompanyDraft }
  | { ok: false; error: { code: string; message: string }; cached: CompanyDraft | null };

/**
 * Import a company: profile, statements and (optionally) a quote, each cached
 * independently. A failing optional quote keeps the otherwise successful
 * statements; a total failure returns any cached draft so the user can review
 * stale data or fall back to manual entry.
 */
export async function importCompany(
  db: Db,
  providerId: string,
  symbol: string,
): Promise<ImportOutcome> {
  const provider = getAdapter(providerId);
  if (!provider) {
    const error = new ProviderError("unsupported", {
      provider: providerId,
      message: `Unknown or unconfigured data provider "${providerId}".`,
    });
    return { ok: false, error: { code: error.code, message: error.message }, cached: null };
  }

  const profileKey = buildCacheKey(provider.id, "profile", { symbol });
  const statementsKey = buildCacheKey(provider.id, "statements", { symbol });
  const quoteKey = buildCacheKey(provider.id, "quote", { symbol });
  const warnings: ProviderWarning[] = [];

  try {
    const profileResult = await cachedFetch<ProviderProfile>({
      db,
      provider: provider.id,
      kind: "profile",
      key: profileKey,
      fetcher: () => provider.getProfile(symbol),
    });

    let statementsResult: { value: ProviderStatements; retrievedAt: string };
    try {
      const live = await cachedFetch<ProviderStatements>({
        db,
        provider: provider.id,
        kind: "statements",
        key: statementsKey,
        fetcher: () => provider.getStatements(symbol),
      });
      statementsResult = { value: live.value, retrievedAt: live.retrievedAt };
    } catch (statementError) {
      const stale = await readStale<ProviderStatements>(db, statementsKey);
      if (!stale) throw statementError;
      warnings.push(warningFromError(statementError, "statements"));
      warnings.push({
        code: "stale_cache",
        message: `Showing cached statements retrieved ${stale.retrievedAt}.`,
        scope: "statements",
      });
      statementsResult = { value: stale.value, retrievedAt: stale.retrievedAt };
    }

    let quote: ProviderQuote | null = null;
    try {
      const quoteResult = await cachedFetch<ProviderQuote | null>({
        db,
        provider: provider.id,
        kind: "quote",
        key: quoteKey,
        fetcher: () => provider.getQuote(symbol),
      });
      quote = quoteResult.value;
    } catch (quoteError) {
      warnings.push(warningFromError(quoteError, "quote"));
    }

    const draft = assembleDraft({
      provider: provider.id,
      profile: profileResult.value,
      statements: statementsResult.value,
      statementsRetrievedAt: statementsResult.retrievedAt,
      quote,
      warnings,
      isDemo: provider.id === "demo",
    });
    return { ok: true, draft };
  } catch (cause) {
    const error = ProviderError.from(cause, provider.id);
    const cached = await readStaleDraft(db, provider, symbol);
    return {
      ok: false,
      error: { code: error.code, message: error.message || plainLanguageFor(error.code) },
      cached,
    };
  }
}