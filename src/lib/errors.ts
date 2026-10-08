/**
 * Error taxonomy shared by providers, the cache and the API layer.
 *
 * Every provider failure is normalised into one of the codes below so the UI
 * can explain the problem in plain language instead of leaking raw payloads.
 */

export type ProviderErrorCode =
  | "invalid_credentials"
  | "quota_exhausted"
  | "premium_endpoint"
  | "no_data"
  | "upstream_failure"
  | "malformed_response"
  | "unsupported"
  | "not_configured"
  | "rate_limited";

const RETRYABLE: ReadonlySet<ProviderErrorCode> = new Set([
  "upstream_failure",
  "rate_limited",
]);

/** Errors that must never be retried automatically (they will not recover quickly). */
const NON_RETRYABLE: ReadonlySet<ProviderErrorCode> = new Set([
  "invalid_credentials",
  "quota_exhausted",
  "premium_endpoint",
  "unsupported",
  "not_configured",
  "no_data",
  "malformed_response",
]);

const PLAIN_LANGUAGE: Record<ProviderErrorCode, string> = {
  invalid_credentials:
    "The data provider rejected the configured credentials. Check the API key on the server.",
  quota_exhausted:
    "The data provider's request quota is used up. Try again later or enter the financials manually.",
  premium_endpoint:
    "This data point is only available on a paid provider plan. You can enter it manually.",
  no_data: "The provider has no data for this company or period.",
  upstream_failure:
    "The data provider is temporarily unavailable. Please try again shortly.",
  malformed_response:
    "The data provider returned a response we could not understand.",
  unsupported: "This provider does not support that request.",
  not_configured: "No data provider is configured for this request.",
  rate_limited: "The provider rate limit was hit. Please wait a moment and try again.",
};

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly provider?: string;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    code: ProviderErrorCode,
    options: { message?: string; provider?: string; status?: number; cause?: unknown } = {},
  ) {
    super(options.message ?? PLAIN_LANGUAGE[code], { cause: options.cause });
    this.name = "ProviderError";
    this.code = code;
    this.provider = options.provider;
    this.status = options.status;
    this.retryable = RETRYABLE.has(code);
  }

  isNonRetryable(): boolean {
    return NON_RETRYABLE.has(this.code);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      provider: this.provider,
      status: this.status,
      retryable: this.retryable,
    };
  }

  static is(value: unknown): value is ProviderError {
    return value instanceof ProviderError;
  }

  static from(value: unknown, provider?: string): ProviderError {
    if (value instanceof ProviderError) return value;
    const message = value instanceof Error ? value.message : String(value);
    return new ProviderError("upstream_failure", { message, provider, cause: value });
  }
}

/** Generic application error used by the API/route layer. */
export class AppError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.details = details;
  }
}

export function plainLanguageFor(code: ProviderErrorCode): string {
  return PLAIN_LANGUAGE[code];
}

/** Serialisable shape returned by API routes on failure. */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function toErrorResponse(error: unknown): { status: number; body: ApiErrorBody } {
  if (error instanceof ProviderError) {
    const status =
      error.code === "invalid_credentials"
        ? 502
        : error.code === "quota_exhausted"
          ? 429
          : error.code === "no_data"
            ? 404
            : error.code === "not_configured"
              ? 501
              : 502;
    return {
      status,
      body: { error: { code: error.code, message: error.message, details: error.toJSON() } },
    };
  }
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { error: { code: "bad_request", message: error.message, details: error.details } },
    };
  }
  return {
    status: 500,
    body: {
      error: {
        code: "internal_error",
        message: "Something went wrong. Please try again.",
      },
    },
  };
}