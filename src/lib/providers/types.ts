import type {
  CompanyIdentity,
  CompanySearchResult,
  RawAnnualStatement,
} from "@/lib/finance/types";
import type { ProviderId, SecurityType } from "@/lib/constants";

export type ProviderProfile = {
  identity: CompanyIdentity;
  reportingCurrency: string | null;
  quoteCurrency: string | null;
  source: string;
  sourceUrl?: string | null;
  /** External identifier (e.g. SEC CIK) when the provider exposes one. */
  externalId?: string | null;
};

export type ProviderQuote = {
  price: number | null;
  quoteDate: string | null;
  currency: string | null;
  sharesOutstanding: number | null;
  sharesOutstandingDate: string | null;
  marketCap: number | null;
  marketCapDate: string | null;
  source: string;
};

export type ProviderStatements = {
  statements: RawAnnualStatement[];
  currency: string | null;
  source: string;
  sourceUrl?: string | null;
};

export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly label: string;
  /** True when the required credentials/configuration are present. */
  isConfigured(): boolean;
  /** Search by ticker or company name. Exact ticker matches must rank first. */
  search(query: string): Promise<CompanySearchResult[]>;
  /** Company profile / identity. */
  getProfile(symbol: string): Promise<ProviderProfile>;
  /** Latest quote and share count. Return null when the provider cannot supply it. */
  getQuote(symbol: string): Promise<ProviderQuote | null>;
  /** Up to five years of annual statements. */
  getStatements(symbol: string): Promise<ProviderStatements>;
}

export const SECURITY_TYPE_ORDER: SecurityType[] = [
  "Ordinary Share",
  "Depositary Receipt",
  "Preferred Share",
  "ETF",
  "Fund",
  "Other",
  "Unknown",
];