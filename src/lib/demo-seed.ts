import type { Db } from "@/lib/db/client";
import { createAnalysis, countAnalyses, saveThesis } from "@/lib/db/repository";
import { draftToCreateInput } from "@/lib/analysis-service";
import { normalizeStatements } from "@/lib/finance/normalize";
import { DemoAdapter, DEMO_SYMBOLS } from "@/lib/providers/mock";
import type { CompanyDraft } from "@/lib/finance/types";
import { DEMO_WORKSPACE_ID } from "@/lib/constants";

/**
 * Seed the separate, public demo workspace with clearly labelled synthetic
 * analyses. Idempotent: does nothing once demo records exist.
 */
export async function ensureDemoSeed(db: Db): Promise<void> {
  const existing = await countAnalyses(db, DEMO_WORKSPACE_ID);
  if (existing > 0) return;

  const adapter = new DemoAdapter();
  const ratings = ["Buy", "Hold"] as const;
  for (const [index, symbol] of DEMO_SYMBOLS.entries()) {
    const [profile, quotes, statements] = await Promise.all([
      adapter.getProfile(symbol),
      adapter.getQuote(symbol),
      adapter.getStatements(symbol),
    ]);
    const normalized = normalizeStatements(statements.statements).map((statement) => ({
      ...statement,
      source: statements.source,
      sourceUrl: statements.sourceUrl ?? null,
      originalCurrency: statement.originalCurrency ?? statements.currency,
    }));
    const latest = normalized.at(-1) ?? null;
    const draft: CompanyDraft = {
      provider: "demo",
      identity: profile.identity,
      market: {
        reportingCurrency: profile.reportingCurrency ?? "USD",
        quoteCurrency: profile.quoteCurrency ?? profile.reportingCurrency ?? "USD",
        sharePrice: quotes.price,
        quoteDate: quotes.quoteDate,
        sharesOutstanding: quotes.sharesOutstanding,
        sharesOutstandingDate: quotes.sharesOutstandingDate,
        marketCap: quotes.marketCap,
        marketCapDate: quotes.marketCapDate,
      },
      valuation: {
        cash: latest?.cashAndEquivalents ?? null,
        cashDate: latest?.periodEnd ?? null,
        totalDebt: latest?.totalDebt ?? null,
        debtDate: latest?.periodEnd ?? null,
      },
      statements: normalized,
      warnings: [],
      source: "Synthetic demo data",
      sourceUrl: null,
      retrievalDate: new Date().toISOString(),
      isDemo: true,
    };

    const { analysis, statements: inputs } = draftToCreateInput(draft, DEMO_WORKSPACE_ID);
    const record = await createAnalysis(db, { ...analysis, isDemo: true }, inputs);
    const target = quotes.price ? Math.round(quotes.price * 1.2 * 100) / 100 : null;
    await saveThesis(
      db,
      record.id,
      DEMO_WORKSPACE_ID,
      {
        recommendation: ratings[index] ?? "Hold",
        targetPrice: target,
        summary:
          "Synthetic demo analysis. Use this workspace to explore the workflow. These figures are not real financial data and the rating is illustrative only.",
        catalysts: ["New product cycle", "Margin expansion"],
        risks: ["Demand slowdown", "Competitive pricing"],
      },
      true,
    );
  }
}