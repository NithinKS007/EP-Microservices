import { logger } from "./logger";
import Opossum from "opossum";

export interface CircuitBreakerConfig<TArgs extends unknown[], TResult> {
  name: string;
  action: (...args: TArgs) => Promise<TResult>;
  timeoutMs?: number;
  errorThresholdPercentage?: number;
  resetTimeoutMs?: number;
  volumeThreshold?: number;
}

export interface CircuitBreakerHandle<TArgs extends unknown[], TResult> {
  fire: (...args: TArgs) => Promise<TResult>;
  shutdown: () => void;
}

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
}: CircuitBreakerConfig<TArgs, TResult>): CircuitBreakerHandle<TArgs, TResult> {
  const breaker = new Opossum((args: { params: TArgs }) => action(...args.params), {
    timeout: timeoutMs,
    errorThresholdPercentage,
    resetTimeout: resetTimeoutMs,
    volumeThreshold,
  });

  breaker.on("open", () => logger.warn(`Circuit breaker opened: ${name}`));
  breaker.on("halfOpen", () => logger.warn(`Circuit breaker half-open: ${name}`));
  breaker.on("close", () => logger.info(`Circuit breaker closed: ${name}`));

  return {
    fire: (...args: TArgs) => breaker.fire({ params: args }) as Promise<TResult>,
    shutdown: () => {
      if (typeof breaker.shutdown === "function") {
        breaker.shutdown();
      }
    },
  };
}
