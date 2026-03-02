import express, { Request, Response } from "express";
import { notFoundMiddleware, errorMiddleware } from "../../utils/src";
import { envConfig } from "./config/env.config";
import eventRoutes from "./routes/event.routes";
import seatRoutes from "./routes/seat.routes";

const app = express();

app.use(express.json({ limit: "10mb" }));

// Health & root routes
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: envConfig.SERVICE_NAME, port: envConfig.PORT });
});

app.get("/", (req: Request, res: Response) => {
  res.json({ status: "ok", service: envConfig.SERVICE_NAME, port: envConfig.PORT });
});

// API routes
app.use("/api/v1/events", eventRoutes);
app.use("/api/v1/events/:eventId/seats", seatRoutes);

// Error handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export { app };
