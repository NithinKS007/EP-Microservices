import "reflect-metadata";
import { container } from "./container";
import { KafkaService, RedisService } from "../../utils/src";
import { logger } from "../../utils/src/logger";
import { app } from "./app";
import { envConfig } from "./config/env.config";
import { closePrisma, connectPrisma } from "./utils/dbconfig";
import { startSagaGrpcServer } from "./grpc/start.server";
import { OutboxWorker } from "./utils/outbox.worker";
import { CancelEventSagaConsumer } from "./utils/cancel.event.saga.consumer";
import { SagaRecoveryJob } from "./utils/saga.recovery.job";

const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  try {
    const kafkaService = container.resolve<KafkaService>("kafkaService");
    const redisService = container.resolve<RedisService>("redisService");

    if (envConfig.KAFKA_ENABLED === "true") {
      await kafkaService.disconnect();
    }

    if (redisService.isConnected()) {
      await redisService.disconnect();
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
    console.log("🚀 Starting POS Backend Server...!");

    // Connect to Database
    const databaseConnected = await connectPrisma();

    if (!databaseConnected) {
      console.error("❌ Failed to connect to database. Exiting...");
      process.exit(1);
    }
    /** Connect producer and consumer */

    const kafkaService = container.resolve<KafkaService>("kafkaService");
    const redisService = container.resolve<RedisService>("redisService");
    const outboxWorker = container.resolve<OutboxWorker>("outboxWorker");

    await redisService.connect();

    if (envConfig.KAFKA_ENABLED === "true") {
      await kafkaService.ensureTopics();
      await kafkaService.connectProducer();
      await kafkaService.connectConsumer();

      const cancelEventSagaConsumer =
        container.resolve<CancelEventSagaConsumer>("cancelEventSagaConsumer");

      await kafkaService.consumeEvents([
        {
          topic: "saga.cancel.event.requested",
          handler: cancelEventSagaConsumer.handle.bind(cancelEventSagaConsumer),
        },
      ]);
    }

    const server = app.listen(envConfig.PORT, () => {
      logger.info(
        `Server is running on port ${envConfig.PORT} with service name "${envConfig.SERVICE_NAME}"`,
      );
    });

    startSagaGrpcServer();
    if (envConfig.KAFKA_ENABLED === "true") {
      outboxWorker.start();
      const sagaRecoveryJob = container.resolve<SagaRecoveryJob>("sagaRecoveryJob");
      sagaRecoveryJob.start();
    }

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
