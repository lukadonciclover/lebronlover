import type { ProviderAdapter, ProviderProfile, ProviderQuote, ProviderStatements } from "@/lib/providers/types";
import type { CompanySearchResult, RawAnnualStatement } from "@/lib/finance/types";

/**
 * Synthetic demo data. This is explicitly NOT live financial data and every
 * surface that displays it labels it as synthetic. It exists so the app is
 * usable (and demonstrable) without any provider credentials.
 */

type DemoCompany = {
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  sector: string;
  industry: string;
  currency: string;
  price: number;
  shares: number;
  statements: RawAnnualStatement[];
};

function s(
  fiscalYear: number,
  values: RawAnnualStatement["values"],
  periodEnd = `${fiscalYear}-12-31`,
): RawAnnualStatement {
  return {
    fiscalYear,
    periodStart: `${fiscalYear}-01-01`,
    periodEnd,
    filingDate: `${fiscalYear + 1}-02-15`,
    values,
    currency: "USD",
    units: "units",
  };
}

const DEMO_COMPANIES: DemoCompany[] = [
  {
    symbol: "HELIO",
    name: "Helios Semiconductors Inc.",
    exchange: "NASDAQ",
    country: "United States",
    sector: "Technology",
    industry: "Semiconductors",
    currency: "USD",
    price: 48.5,
    shares: 220,
    statements: [
      s(2021, {
        revenue: 1_200_000_000,
        costOfRevenue: 720_000_000,
        grossProfit: 480_000_000,
        operatingIncome: 168_000_000,
        depreciationAmortisation: 96_000_000,
        netIncome: 120_000_000,
        eps: 0.55,
        cashAndEquivalents: 300_000_000,
        totalAssets: 2_100_000_000,
        currentAssets: 900_000_000,
        currentLiabilities: 420_000_000,
        shortTermDebt: 90_000_000,
        longTermDebt: 420_000_000,
        totalDebt: 510_000_000,
        totalLiabilities: 930_000_000,
        shareholdersEquity: 1_170_000_000,
        operatingCashFlow: 260_000_000,
        capex: 140_000_000,
      }),
      s(2022, {
        revenue: 1_450_000_000,
        costOfRevenue: 840_000_000,
        grossProfit: 610_000_000,
        operatingIncome: 232_000_000,
        depreciationAmortisation: 104_000_000,
        netIncome: 168_000_000,
        eps: 0.76,
        cashAndEquivalents: 360_000_000,
        totalAssets: 2_420_000_000,
        currentAssets: 1_040_000_000,
        currentLiabilities: 470_000_000,
        shortTermDebt: 80_000_000,
        longTermDebt: 460_000_000,
        totalDebt: 540_000_000,
        totalLiabilities: 1_010_000_000,
        shareholdersEquity: 1_410_000_000,
        operatingCashFlow: 330_000_000,
        capex: 175_000_000,
      }),
      s(2023, {
        revenue: 1_610_000_000,
        costOfRevenue: 930_000_000,
        grossProfit: 680_000_000,
        operatingIncome: 268_000_000,
        depreciationAmortisation: 118_000_000,
        netIncome: 196_000_000,
        eps: 0.89,
        cashAndEquivalents: 420_000_000,
        totalAssets: 2_760_000_000,
        currentAssets: 1_180_000_000,
        currentLiabilities: 500_000_000,
        shortTermDebt: 70_000_000,
        longTermDebt: 500_000_000,
        totalDebt: 570_000_000,
        totalLiabilities: 1_120_000_000,
        shareholdersEquity: 1_640_000_000,
        operatingCashFlow: 392_000_000,
        capex: 210_000_000,
      }),
      s(2024, {
        revenue: 1_840_000_000,
        costOfRevenue: 1_050_000_000,
        grossProfit: 790_000_000,
        operatingIncome: 326_000_000,
        depreciationAmortisation: 132_000_000,
        netIncome: 242_000_000,
        eps: 1.1,
        cashAndEquivalents: 520_000_000,
        totalAssets: 3_150_000_000,
        currentAssets: 1_360_000_000,
        currentLiabilities: 560_000_000,
        shortTermDebt: 60_000_000,
        longTermDebt: 540_000_000,
        totalDebt: 600_000_000,
        totalLiabilities: 1_260_000_000,
        shareholdersEquity: 1_890_000_000,
        operatingCashFlow: 468_000_000,
        capex: 250_000_000,
      }),
    ],
  },
  {
    symbol: "MRDG",
    name: "Meridian Retail Group PLC",
    exchange: "LSE",
    country: "United Kingdom",
    sector: "Consumer Discretionary",
    industry: "Apparel Retail",
    currency: "GBP",
    price: 3.15,
    shares: 400,
    statements: [
      s(2022, {
        revenue: 900_000_000,
        grossProfit: 315_000_000,
        operatingIncome: 72_000_000,
        netIncome: 41_000_000,
        cashAndEquivalents: 120_000_000,
        totalAssets: 1_450_000_000,
        currentAssets: 420_000_000,
        currentLiabilities: 380_000_000,
        totalDebt: 460_000_000,
        shareholdersEquity: 540_000_000,
        operatingCashFlow: 130_000_000,
        capex: 55_000_000,
      }),
      s(2023, {
        revenue: 940_000_000,
        grossProfit: 330_000_000,
        operatingIncome: 68_000_000,
        netIncome: 33_000_000,
        cashAndEquivalents: 98_000_000,
        totalAssets: 1_420_000_000,
        currentAssets: 400_000_000,
        currentLiabilities: 395_000_000,
        totalDebt: 470_000_000,
        shareholdersEquity: 520_000_000,
        operatingCashFlow: 118_000_000,
        capex: 60_000_000,
      }),
      s(2024, {
        revenue: 985_000_000,
        grossProfit: 355_000_000,
        operatingIncome: 79_000_000,
        netIncome: 44_000_000,
        cashAndEquivalents: 110_000_000,
        totalAssets: 1_470_000_000,
        currentAssets: 430_000_000,
        currentLiabilities: 390_000_000,
        totalDebt: 455_000_000,
        shareholdersEquity: 565_000_000,
        operatingCashFlow: 142_000_000,
        capex: 64_000_000,
      }),
    ],
  },
];

export class DemoAdapter implements ProviderAdapter {
  readonly id = "demo" as const;
  readonly label = "Synthetic demo data";

  isConfigured(): boolean {
    return process.env.ENABLE_DEMO_DATA !== "false";
  }

  async search(query: string): Promise<CompanySearchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return DEMO_COMPANIES.filter(
      (company) =>
        company.symbol.toLowerCase().includes(q) || company.name.toLowerCase().includes(q),
    ).map((company) => ({
      provider: this.id,
      symbol: company.symbol,
      name: company.name,
      exchange: company.exchange,
      country: company.country,
      region: null,
      securityType: "Ordinary Share" as const,
      currency: company.currency,
      dataSource: "Synthetic demo data (not live)",
      rank: company.symbol.toLowerCase() === q ? 0 : 10,
    }));
  }

  private find(symbol: string): DemoCompany {
    const company = DEMO_COMPANIES.find(
      (candidate) => candidate.symbol.toUpperCase() === symbol.trim().toUpperCase(),
    );
    if (!company) {
      throw new Error(`Unknown demo company: ${symbol}`);
    }
    return company;
  }

  async getProfile(symbol: string): Promise<ProviderProfile> {
    const company = this.find(symbol);
    return {
      identity: {
        name: company.name,
        ticker: company.symbol,
        exchange: company.exchange,
        country: company.country,
        sector: company.sector,
        industry: company.industry,
        description:
          "Synthetic demo company used to exercise the Investment Pitch Copilot workflow. Not a real security.",
        securityType: "Ordinary Share",
      },
      reportingCurrency: company.currency,
      quoteCurrency: company.currency,
      source: "Synthetic demo data",
      sourceUrl: null,
    };
  }

  async getQuote(symbol: string): Promise<ProviderQuote> {
    const company = this.find(symbol);
    const date = new Date().toISOString().slice(0, 10);
    return {
      price: company.price,
      quoteDate: date,
      currency: company.currency,
      sharesOutstanding: company.shares,
      sharesOutstandingDate: date,
      marketCap: company.price * company.shares,
      marketCapDate: date,
      source: "Synthetic demo data",
    };
  }

  async getStatements(symbol: string): Promise<ProviderStatements> {
    const company = this.find(symbol);
    return {
      statements: company.statements,
      currency: company.currency,
      source: "Synthetic demo data",
      sourceUrl: null,
    };
  }
}

export const DEMO_SYMBOLS = DEMO_COMPANIES.map((company) => company.symbol);