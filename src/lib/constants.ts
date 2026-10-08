/**
 * Shared, serialisable constants for the Investment Pitch Copilot.
 * These are safe to import from both client and server code.
 */

export const CURRENCIES = [
  "USD",
  "SGD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "HKD",
  "CNY",
  "INR",
  "CHF",
  "JPY",
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

export const RECOMMENDATIONS = ["Buy", "Hold", "Sell"] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export const SECURITY_TYPES = [
  "Ordinary Share",
  "ETF",
  "Fund",
  "Depositary Receipt",
  "Preferred Share",
  "Other",
  "Unknown",
] as const;
export type SecurityType = (typeof SECURITY_TYPES)[number];

export const UNIT_SCALES = ["units", "thousands", "millions", "billions"] as const;
export type UnitScale = (typeof UNIT_SCALES)[number];

export const VALUE_ORIGINS = ["reported", "derived", "manual"] as const;
export type ValueOrigin = (typeof VALUE_ORIGINS)[number];

export const PROVIDERS = ["alpha_vantage", "sec", "demo"] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export const MAX_FISCAL_YEARS = 5;
export const MIN_FISCAL_YEARS = 1;
export const DEFAULT_FISCAL_YEARS = 3;
export const THESIS_SUMMARY_MAX = 1000;

/** Label used for the aggregate figures that live on the analysis row. */
export const MONEY_UNIT_LABEL = "millions";
export const MONEY_UNIT_NOTE =
  "Monetary values are shown in millions of the reporting currency unless stated otherwise.";

/** Public demo workspace id. Records in this workspace are visible to everyone and read-only. */
export const DEMO_WORKSPACE_ID = "demo";
export const WORKSPACE_COOKIE = "ipc_ws";
export const WORKSPACE_HEADER = "x-workspace-id";