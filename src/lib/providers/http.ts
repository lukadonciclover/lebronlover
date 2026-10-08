import { ProviderError } from "@/lib/errors";

const DEFAULT_TIMEOUT_MS = 12_000;

export type FetchJsonOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Bounded retries for transient network/5xx failures only. */
  retries?: number;
  provider?: string;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch JSON with a timeout and bounded retries. Retries only apply to
 * transient failures (network errors and 5xx); client errors are surfaced
 * immediately via `status` so adapters can classify them.
 */
export async function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<{ data: T; response: Response; url: string }> {
  const { headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS, retries = 2, provider } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", ...headers },
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);

      if (response.status >= 500 && attempt < retries) {
        lastError = new ProviderError("upstream_failure", {
          provider,
          status: response.status,
          message: `Upstream responded with ${response.status}.`,
        });
        await delay(250 * (attempt + 1));
        continue;
      }

      if (!response.ok) {
        throw new ProviderError("upstream_failure", {
          provider,
          status: response.status,
          message: `Request failed with status ${response.status}.`,
        });
      }

      let data: T;
      try {
        data = (await response.json()) as T;
      } catch (cause) {
        throw new ProviderError("malformed_response", {
          provider,
          cause,
          message: "The provider returned a response that was not valid JSON.",
        });
      }
      return { data, response, url };
    } catch (cause) {
      clearTimeout(timer);
      if (cause instanceof ProviderError && cause.status && cause.status < 500) {
        throw cause;
      }
      lastError = cause;
      const isAbort = cause instanceof Error && cause.name === "AbortError";
      if (attempt < retries) {
        await delay(250 * (attempt + 1));
        continue;
      }
      if (isAbort) {
        throw new ProviderError("upstream_failure", {
          provider,
          cause,
          message: "The data provider timed out.",
        });
      }
      if (cause instanceof ProviderError) throw cause;
      throw new ProviderError("upstream_failure", { provider, cause });
    }
  }

  throw ProviderError.from(lastError, provider);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}