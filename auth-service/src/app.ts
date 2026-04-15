import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Request, Response } from "express";
import { router } from "./routes/auth.routes";
import { notFoundMiddleware, errorMiddleware, RateLimiter, RedisService } from "../../utils/src";
import { envConfig } from "./config/env.config";
import { container } from "./container";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());

const redisService = container.resolve<RedisService>("redisService");
const rateLimiter = container.resolve<RateLimiter>("rateLimiter");
rateLimiter.addClient(redisService.returnRawClient());
app.use("/api", rateLimiter.apiGatewayLimiter());
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

/*
 * Health check endpoint.
 */
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: envConfig.SERVICE_NAME, port: envConfig.PORT });
});

app.get("/", (req: Request, res: Response) => {
  res.json({ message: `message send from server ${envConfig.PORT}` });
});

/*
 * API routes.
 */
app.use("/api/v1/auth", router);

/*
 * Error handling.
 */
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export { app };
