import { sendResponse, logger, RateLimiter, StatusCodes } from "../../utils/src";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import { proxyServices } from "./config/service.proxy";
import { envConfig } from "./config/env.config";
import { prismaErrorHandler } from "./prisma.error.handler";
import { AppError } from "../../utils/src/error.handling.middleware";

export const createApp = (rateLimiter: RateLimiter) => {
const app = express();

  // Security & core middleware
app.use(helmet());
app.use(
  cors({
    origin: envConfig.CLIENT_URL || "*",
    credentials: true,
  }),
);

// Trust proxy is essential for identifying correct client IPs behind load balancers/proxies
app.set("trust proxy", 1);

// Apply rate limiter immediately before other routes
app.use(rateLimiter.apiGatewayLimiter());
app.use(morgan("dev"));

/**
 * Health check endpoint.
 * Used by load balancers or monitoring services to verify gateway is alive.
 */
app.get("/health", (req: Request, res: Response) => {
  sendResponse(res, 200, null, "OK");
});

/**
 * Sets up proxy routes for underlying microservices.
 * All requests to configured paths are forwarded to their respective services.
 */

proxyServices(app);

/**
 * Handles all requests that do not match any route or proxy.
 * Must be placed after all routes.
 */
app.use((req: Request, res: Response) => {
  logger.warn(`Resource not found [WARN] ${req.method} ${req.url}`);
  sendResponse(res, 404, null, "Not found");
});

/**
 * Catches all unhandled errors from routes or middleware.
 * Must be the last middleware in the stack.
 */
app.use(prismaErrorHandler);
app.use((err: Error | AppError, req: Request, res: Response, next: NextFunction) => {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : StatusCodes.InternalServerError;
  const message = isAppError ? err.message : "Internal server error";

  logger.error(`Unhandled error [ERROR] ${err.message}`);
  sendResponse(res, statusCode, null, message);
});

  return app;
};
