import "reflect-metadata";
import { container } from "./container";
import { KafkaService } from "../../utils/src/kafka.service";
import { logger } from "../../utils/src/logger";
import { app } from "./app";
import { envConfig } from "./config/env.config";
import { closePrisma, connectPrisma } from "./utils/dbconfig";
import { startBookingGrpcServer } from "./grpc/start.server";
import { OutboxWorker } from "./utils/outbox.worker";
import { BookingExpiryJob } from "./utils/booking.expiry.job";

let kafkaService: KafkaService | null = null;

const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  try {
    if (envConfig.KAFKA_ENABLED === "true" && kafkaService) {
      await kafkaService.disconnect();
    }

    // Close database connection
    await closePrisma();

    console.log("✅ Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during graceful shutdown:", error);
    process.exit(1);
  }
};

// Handle process signals for graceful shutdown
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

const startServer = async () => {
  try {
    // Connect to Database
    const databaseConnected = await connectPrisma();

    if (!databaseConnected) {
      console.error("❌ Failed to connect to database. Exiting...");
      process.exit(1);
    }
    /** Connect producer and consumer */

    kafkaService = container.resolve<KafkaService>("kafkaService");
    const outboxWorker = container.resolve<OutboxWorker>("outboxWorker");
    const bookingExpiryJob = container.resolve<BookingExpiryJob>("bookingExpiryJob");

    if (envConfig.KAFKA_ENABLED === "true") {
      await kafkaService.connectProducer();
      await kafkaService.connectConsumer();
    }

    const server = app.listen(envConfig.PORT, () => {
      logger.info(
        `Server is running on port ${envConfig.PORT} with service name "${envConfig.SERVICE_NAME}"`,
      );
    });

    startBookingGrpcServer();
    if (envConfig.KAFKA_ENABLED === "true") {
      outboxWorker.start();
    }
    bookingExpiryJob.start();
    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(`❌ Port ${envConfig.PORT} is already in use`);
      } else {
        console.error("❌ Server error:", error);
      }
      process.exit(1);
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      logger.error(err.message);
    } else {
      logger.error(`Unknown error starting server [ERROR] ${JSON.stringify(err)}`);
    }

    process.exit(1);
  }
};

startServer();
