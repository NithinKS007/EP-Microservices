import { PrismaClient } from "../generated/prisma/client";
import { logger } from "../../../utils/src";
import { envConfig } from "../config/env.config";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Create a PrismaClient instance with logging enabled.
 * - 'query': logs all executed queries
 * - 'info': logs informational messages
 * - 'warn': logs warnings
 * - 'error': logs errors
 *
 * The errorFormat 'pretty' formats error messages for readability.
 */

const adapter = new PrismaPg({ connectionString: envConfig.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: ["query", "info", "warn", "error"],
  errorFormat: "pretty",
}).$extends({
  query: {
    async $allOperations({
      operation,
      model,
      args,
      query,
    }: {
      operation: string;
      model?: string;
      args: unknown;
      query: (args: unknown) => Promise<unknown>;
    }) {
      const start = Date.now();
      const result = await query(args);
      const duration = Date.now() - start;
      logger.info(`Prisma ${model ?? "RAW"}.${operation} took ${duration}ms`);
      return result;
    },
  },
});

/**
 * Get database connection info (sanitized for logging)
 * Hides password but shows host, port, and database name
 */
export const getDatabaseInfo = (): string => {
  const dbUrl = envConfig.DATABASE_URL || "Not configured";

  if (dbUrl === "Not configured") {
    return dbUrl;
  }

  try {
    // Parse the DATABASE_URL to extract connection details
    const url = new URL(dbUrl);
    const host = url.hostname;
    const port = url.port || "5432";
    const database = url.pathname.replace("/", "");
    const username = url.username;

    return `postgresql://${username}:***@${host}:${port}/${database}`;
  } catch (error) {
    return "Invalid DATABASE_URL format";
  }
};

/**
 * Connect to the database using Prisma.
 * Logs success or failure using the Logger utility.
 *
 * Returns True if connection succeeds, false otherwise
 */
export const connectPrisma = async (): Promise<boolean> => {
  try {
    await prisma.$connect();
    logger.info("✅ Prisma connected");
    return true;
  } catch (err: unknown) {
    if (err instanceof Error) logger.error(err.message);
    else logger.error(`Unknown error connecting to Prisma [ERROR] ${JSON.stringify(err)}`);
    process.exit(1);
  }
};

/**
 * Disconnect Prisma from the database.
 * Logs success or any error that occurs during disconnection.
 */
export const closePrisma = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info("🛑 Prisma disconnected");
  } catch (err: unknown) {
    if (err instanceof Error) {
      logger.error(err.message);
    } else {
      logger.error(`Unknown error disconnecting Prisma [ERROR] ${JSON.stringify(err)}`);
    }
    process.exit(1);
  }
};
