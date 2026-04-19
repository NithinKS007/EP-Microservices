import { logger } from "./logger";
import Opossum from "opossum";
import { AppError } from "./error.handling.middleware";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig<TArgs extends unknown[], TResult> {
  name: string;
  action: (...args: TArgs) => Promise<TResult>;
  timeoutMs?: number;
  errorThresholdPercentage?: number;
  resetTimeoutMs?: number;
  volumeThreshold?: number;
  rollingCountTimeoutMs?: number;
  rollingCountBuckets?: number;
  capacity?: number;
  allowWarmUp?: boolean;
  errorFilter?: (error: Error) => boolean;
  fallback?: (...args: TArgs) => Promise<TResult> | TResult;
}

export interface CircuitBreakerHandle<TArgs extends unknown[], TResult> {
  fire: (...args: TArgs) => Promise<TResult>;
  shutdown: () => void;
  name: string;
  getState: () => CircuitState;
  getStats: () => Opossum.Stats;
}

/**
 * Domain and validation errors should not trip infrastructure circuit breakers.
 */
export const ignoreExpectedCircuitBreakerError = (error: Error): boolean =>
  error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500;

/**
 * Creates a lightweight circuit breaker around an async operation.
 */
export function createCircuitBreaker<TArgs extends unknown[], TResult>({
  name,
  action,
  timeoutMs = 5000,
  errorThresholdPercentage = 50,
  resetTimeoutMs = 15000,
  volumeThreshold = 5,
  rollingCountTimeoutMs = 10000,
  rollingCountBuckets = 10,
  capacity = Number.MAX_SAFE_INTEGER,
  allowWarmUp = true,
  errorFilter = ignoreExpectedCircuitBreakerError,
  fallback,
}: CircuitBreakerConfig<TArgs, TResult>): CircuitBreakerHandle<TArgs, TResult> {
  const breaker = new Opossum((args: { params: TArgs }) => action(...args.params), {
    name,
    timeout: timeoutMs,
    errorThresholdPercentage,
    resetTimeout: resetTimeoutMs,
    volumeThreshold,
    rollingCountTimeout: rollingCountTimeoutMs,
    rollingCountBuckets,
    capacity,
    allowWarmUp,
    errorFilter,
  });

  if (fallback) {
    breaker.fallback(({ params }: { params: TArgs }) => fallback(...params));
  }

  breaker.on("open", () => logger.warn(`Circuit breaker opened: ${name}`));
  breaker.on("halfOpen", () => logger.warn(`Circuit breaker half-open: ${name}`));
  breaker.on("close", () => logger.info(`Circuit breaker closed: ${name}`));
  breaker.on("reject", (error) => logger.warn(`Circuit breaker rejected request: ${name} ${error.message}`));
  breaker.on("timeout", (error) => logger.warn(`Circuit breaker timeout: ${name} ${error.message}`));
  breaker.on("semaphoreLocked", (error) =>
    logger.warn(`Circuit breaker bulkhead saturated: ${name} ${error.message}`),
  );
  breaker.on("fallback", (_result, error) =>
    logger.warn(`Circuit breaker fallback executed: ${name} ${error.message}`),
  );

  return {
    name,
    fire: (...args: TArgs) => breaker.fire({ params: args }) as Promise<TResult>,
    getState: (): CircuitState => {
      if (breaker.opened) return "OPEN";
      if (breaker.halfOpen) return "HALF_OPEN";
      return "CLOSED";
    },
    getStats: () => breaker.stats,
    shutdown: () => {
      if (typeof breaker.shutdown === "function") {
        breaker.shutdown();
      }
    },
  };
}
