import "reflect-metadata"; 
import { container } from "./container";
import { KafkaService, logger } from "../../utils/src";
import { app } from "./app";
import { envConfig } from "./config/env.config";

/**
 * Gracefully shuts down the server upon receiving termination signals.
 * Performs any necessary cleanup before exiting the process.
 *
 * @async
 * @function gracefulShutdown
 * @param {string} signal - The signal received (e.g., SIGINT, SIGTERM).
 */

const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  try {
    console.log("✅ Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during graceful shutdown:", error);
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

    /** Connect producer and consumer */

    const kafkaService = container.resolve<KafkaService>('kafkaService');

    if (envConfig.KAFKA_ENABLED === "true") {
      await kafkaService.connectProducer();
      await kafkaService.connectConsumer();
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
      logger.error(`Error starting server [ERROR] ${err.message}`);
    } else {
      logger.error(`Error starting server [ERROR] ${JSON.stringify(err)}`);
    }
    process.exit(1);
  }
};

 startServer();
