import { ServiceUnavailableError, TimeoutError } from "./error.handling.middleware";

export interface HttpRequestConfig<TResult> {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string | Buffer | Uint8Array | Record<string, unknown>;
  timeoutMs?: number;
  parseResponse?: (response: Response) => Promise<TResult>;
}

/**
 * Minimal HTTP client with deadline enforcement for third-party dependencies.
 * The caller decides whether to wrap this in a circuit breaker.
 */
export async function executeHttpRequest<TResult = unknown>({
  url,
  method = "GET",
  headers = {},
  body,
  timeoutMs = 5000,
  parseResponse = (response) => response.json() as Promise<TResult>,
}: HttpRequestConfig<TResult>): Promise<TResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resolvedBody =
      body && typeof body === "object" && !Buffer.isBuffer(body) && !(body instanceof Uint8Array)
        ? JSON.stringify(body)
        : body;

    const response = await fetch(url, {
      method,
      headers: {
        ...(resolvedBody && typeof resolvedBody === "string" ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: resolvedBody as BodyInit | null | undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ServiceUnavailableError(
        `HTTP ${method} ${url} failed with status ${response.status}`,
      );
    }

    return await parseResponse(response);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TimeoutError(`HTTP ${method} ${url} timed out after ${timeoutMs}ms`);
    }

    if (error instanceof Error) {
      throw new ServiceUnavailableError(`HTTP ${method} ${url} failed: ${error.message}`);
    }

    throw new ServiceUnavailableError(`HTTP ${method} ${url} failed`);
  } finally {
    clearTimeout(timeout);
  }
}
