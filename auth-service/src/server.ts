import "reflect-metadata";
import { container } from "./container";
import { KafkaService, logger, RedisService } from "../../utils/src";
import { app } from "./app";
import { envConfig } from "./config/env.config";
import { TokenCleanupJob } from "./utils/cronjob";
import { EmailAvailabilityService } from "./services/email.availability.service";

let kafkaService: KafkaService | null = null;

/**
 * Gracefully shuts down the server upon receiving termination signals.
 * Performs any necessary cleanup before exiting the process.
 *
 * @async
 * @function gracefulShutdown
 * @param {string} signal - The signal received (e.g., SIGINT, SIGTERM).
 */

const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  try {
    if (envConfig.KAFKA_ENABLED === "true" && kafkaService) {
      await kafkaService.disconnect();
    }

    const redisService = container.resolve<RedisService>("redisService");
    if (redisService.isConnected()) {
      await redisService.disconnect();
    }

    console.log("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
};

/**
 * Listen for termination signals and trigger graceful shutdown.
 */

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

/**
 * Starts the Express server on the configured port.
 * Logs server startup info and handles any startup errors.
 *
 * @function startServer
 */

const startServer = async () => {
  try {
    const server = app.listen(envConfig.PORT, () => {
      logger.info(
        `Server is running on port ${envConfig.PORT} with service name "${envConfig.SERVICE_NAME}"`,
      );
    });

    kafkaService = container.resolve<KafkaService>("kafkaService");
    const redisService = container.resolve<RedisService>("redisService");
    const emailAvailabilityService =
      container.resolve<EmailAvailabilityService>("emailAvailabilityService");

    if (envConfig.KAFKA_ENABLED === "true") {
      await kafkaService.connectProducer();
      await kafkaService.connectConsumer();
    }

    try {
      await redisService.connect();
      await emailAvailabilityService.initializeBloomFilter();
      logger.info("Auth-service email Bloom/Redis index connected");
    } catch (error) {
      logger.warn(
        `Auth-service Redis unavailable. Email availability checks will fall back to database only. ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      );
    }

    const tokenCleanupJob = container.resolve<TokenCleanupJob>("tokenCleanupJob");
    tokenCleanupJob.start();

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${envConfig.PORT} is already in use`);
      } else {
        console.error("Server error:", error);
      }
      process.exit(1);
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      logger.error(`Error starting server [ERROR] ${err.message}`);
    } else {
      logger.error(`Error starting server [ERROR] ${JSON.stringify(err)}`);
    }
    process.exit(1);
  }
};

startServer();
