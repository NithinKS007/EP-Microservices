import express, { Request, Response } from "express";
import { notFoundMiddleware, errorMiddleware } from "./../../utils/src"
import { envConfig } from "./config/env.config";
import webhookRoutes from "./routes/webhook.route";
import paymentRoutes from "./routes/payment.route";

const app = express();

app.use("/api/v1/payment/webhook", webhookRoutes);
app.use(express.json({ limit: "10mb" }));

// Health & root routes
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: envConfig.SERVICE_NAME, port: envConfig.PORT });
});

app.get("/", (req: Request, res: Response) => {
  res.json({ status: "ok", service: envConfig.SERVICE_NAME, port: envConfig.PORT });
});

app.use("/api/v1/payment", paymentRoutes);

// Error handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export { app };
