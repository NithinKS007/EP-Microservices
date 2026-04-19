import { CircuitBreakerConfig } from "./circuit.breaker";

export type CircuitPolicyProfile =
  | "internalQuery"
  | "internalCommand"
  | "externalRead"
  | "externalWrite"
  | "optionalCache";

export type CircuitBreakerPolicy = Omit<
  CircuitBreakerConfig<unknown[], unknown>,
  "name" | "action" | "errorFilter" | "fallback"
>;

/**
 * Central breaker presets so teams do not hard-code ad-hoc thresholds everywhere.
 */
export const circuitBreakerPolicies: Record<CircuitPolicyProfile, CircuitBreakerPolicy> = {
  internalQuery: {
    timeoutMs: 3000,
    errorThresholdPercentage: 50,
    resetTimeoutMs: 10000,
    volumeThreshold: 20,
    rollingCountTimeoutMs: 10000,
    rollingCountBuckets: 10,
    allowWarmUp: true,
    capacity: 500,
  },
  internalCommand: {
    timeoutMs: 5000,
    errorThresholdPercentage: 50,
    resetTimeoutMs: 15000,
    volumeThreshold: 20,
    rollingCountTimeoutMs: 10000,
    rollingCountBuckets: 10,
    allowWarmUp: true,
    capacity: 250,
  },
  externalRead: {
    timeoutMs: 4000,
    errorThresholdPercentage: 40,
    resetTimeoutMs: 20000,
    volumeThreshold: 10,
    rollingCountTimeoutMs: 15000,
    rollingCountBuckets: 10,
    allowWarmUp: true,
    capacity: 100,
  },
  externalWrite: {
    timeoutMs: 7000,
    errorThresholdPercentage: 35,
    resetTimeoutMs: 30000,
    volumeThreshold: 10,
    rollingCountTimeoutMs: 15000,
    rollingCountBuckets: 10,
    allowWarmUp: true,
    capacity: 50,
  },
  optionalCache: {
    timeoutMs: 500,
    errorThresholdPercentage: 50,
    resetTimeoutMs: 5000,
    volumeThreshold: 20,
    rollingCountTimeoutMs: 10000,
    rollingCountBuckets: 10,
    allowWarmUp: true,
    capacity: 1000,
  },
};

export function getCircuitBreakerPolicy(
  profile: CircuitPolicyProfile,
  overrides: Partial<CircuitBreakerPolicy> = {},
): CircuitBreakerPolicy {
  return {
    ...circuitBreakerPolicies[profile],
    ...overrides,
  };
}
