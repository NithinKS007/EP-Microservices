import rateLimit, {
  RateLimitRequestHandler,
  Options,
} from "express-rate-limit";
import { Request, Response } from "express";
import { RedisStore } from "rate-limit-redis";
import type { RedisClientType } from "redis";
import { sendResponse } from "./http.response";
import { StatusCodes } from "./http.status.codes";

/**
 * RateLimiter is a utility class that provides configurable
 * rate limiting middleware for Express applications.
 *
 * Supports both in-memory and Redis-backed distributed stores.
 */

export class RateLimiter {
  private redisClient?: RedisClientType;

  addClient(client: RedisClientType){
    this.redisClient = client;
  }

  private create(
    windowMs: number,
    maxRequests: number
  ): RateLimitRequestHandler {
    const options: Partial<Options> = {
      windowMs,
      max: maxRequests,
      message: "Limit exceeded",
      statusCode: StatusCodes.RateLimit,
      handler: (_req: Request, res: Response) => {
        sendResponse(
          res,
          StatusCodes.RateLimit,
          null,
          "Limit exceeded"
        );
      },
      standardHeaders: true,
      legacyHeaders: false,
    };

    if (this.redisClient) {
      options.store = new RedisStore({
        sendCommand: (...args: string[]) =>
          this.redisClient!.sendCommand(args),
        prefix: "ep:rl:",
      });
    }

    return rateLimit(options);
  }

  public apiGatewayLimiter(): RateLimitRequestHandler {
    return this.create(60 * 1000, 150);
  }

  public authServiceLimiter(): RateLimitRequestHandler {
    return this.create(60 * 1000, 10);
  }
}