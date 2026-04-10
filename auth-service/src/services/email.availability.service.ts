import { logger, RedisService } from "../../../utils/src";
import { envConfig } from "../config/env.config";
import { UserServiceGrpcClient } from "../grpc/user.client";

export type EmailAvailabilityResult = {
  email: string;
  normalizedEmail: string;
  available: boolean;
  source: string;
  bloomMaybePresent: boolean | null;
};

export class EmailAvailabilityService {
  private readonly redisService: RedisService;
  private readonly userServiceGrpcClient: UserServiceGrpcClient;
  private bloomFilterInitialized = false;
  private bloomFilterInitializationPromise: Promise<void> | null = null;

  constructor({
    redisService,
    userServiceGrpcClient,
  }: {
    redisService: RedisService;
    userServiceGrpcClient: UserServiceGrpcClient;
  }) {
    this.redisService = redisService;
    this.userServiceGrpcClient = userServiceGrpcClient;
  }

  async initializeBloomFilter(force = false): Promise<void> {
    if (!this.redisService.isConnected()) {
      return;
    }

    if (this.bloomFilterInitialized && !force) {
      return;
    }

    if (!this.bloomFilterInitializationPromise || force) {
      this.bloomFilterInitializationPromise = (async () => {
        try {
          await this.redisService.bfReserve(
            envConfig.AUTH_EMAIL_BLOOM_KEY,
            envConfig.AUTH_EMAIL_BLOOM_ERROR_RATE,
            envConfig.AUTH_EMAIL_BLOOM_CAPACITY,
            {
              expansion: envConfig.AUTH_EMAIL_BLOOM_EXPANSION,
            }
          );

          this.bloomFilterInitialized = true;
        } catch (error) {
          this.bloomFilterInitialized = false;
          this.bloomFilterInitializationPromise = null;
          throw error;
        }
      })();
    }

    await this.bloomFilterInitializationPromise;
  }

  async checkEmailAvailability(
    email: string
  ): Promise<EmailAvailabilityResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const emailExistsKey = `${envConfig.AUTH_EMAIL_EXISTS_CACHE_PREFIX}:${normalizedEmail}`;

    if (this.redisService.isConnected()) {
      try {
        await this.initializeBloomFilter();

        const bloomMaybePresent = await this.redisService.bfExists(
          envConfig.AUTH_EMAIL_BLOOM_KEY,
          normalizedEmail
        );

        const cacheHit = await this.redisService.get(emailExistsKey);

        if (cacheHit === "1") {
          return {
            email,
            normalizedEmail,
            available: false,
            source: "redis_exact_cache",
            bloomMaybePresent,
          };
        }

        const userData =
          await this.userServiceGrpcClient.findUserByEmail({
            email: normalizedEmail,
          });

        if (userData.user) {
          await this.rememberExistingEmail(normalizedEmail);

          return {
            email,
            normalizedEmail,
            available: false,
            source: "database",
            bloomMaybePresent,
          };
        }

        return {
          email,
          normalizedEmail,
          available: true,
          source: "database",
          bloomMaybePresent,
        };
      } catch (error) {
        logger.warn(
          `Email availability check failed for ${normalizedEmail}. Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    return {
      email,
      normalizedEmail,
      available: true,
      source: "fallback",
      bloomMaybePresent: null,
    };
  }

  async rememberExistingEmail(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const emailExistsKey = `${envConfig.AUTH_EMAIL_EXISTS_CACHE_PREFIX}:${normalizedEmail}`;

    if (!this.redisService.isConnected()) {
      return;
    }

    try {
      await this.initializeBloomFilter(true);

      await Promise.all([
        this.redisService.set(emailExistsKey, "1"),
        this.redisService.bfAdd(
          envConfig.AUTH_EMAIL_BLOOM_KEY,
          normalizedEmail
        ),
      ]);
    } catch (error) {
      logger.warn(
        `Failed to update Redis/Bloom email index for ${normalizedEmail}. Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}