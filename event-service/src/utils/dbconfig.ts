import { PrismaClient } from "../generated/prisma/client";
import { logger } from "../../../utils/src";
import { envConfig } from "../config/env.config";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

/**
 * Returns the runtime database URL and pool configuration based on NODE_ENV.
 * development -> DATABASE_URL_DEV
 * production  -> DATABASE_URL_PROD
 */
export function findDatabaseUrl() {
  const isProduction = envConfig.NODE_ENV === "production";

  const url = isProduction
    ? envConfig.DATABASE_URL_PROD.trim()
    : envConfig.DATABASE_URL_DEV.trim();

  if (!url) {
    throw new Error(
      isProduction
        ? "DATABASE_URL_PROD is not configured"
        : "DATABASE_URL_DEV is not configured"
    );
  }

  const poolConfig = isProduction
    ? {
        max: 2,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        maxLifetimeSeconds: 3600,
      }
    : {
        max: 5,
      };

  return {
    url,
    poolConfig,
  };
}

/**
 * Returns the direct DB URL for Prisma CLI (migrations, studio, db push).
 * Strictly requires DB_DIRECT_URL from envConfig.
 */
export function findDirectDatabaseUrl(): string {
  const directUrl = envConfig.DB_DIRECT_URL?.trim();
  if (directUrl) return directUrl;
  throw new Error("No database connection string (DB_DIRECT_URL) found in environment.");
}

const adapter = new PrismaPg({
  connectionString: findDatabaseUrl().url,
  ...findDatabaseUrl().poolConfig,
});

export const prisma = new PrismaClient({
  adapter,
  log: ["info", "warn", "error"],
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
 */
export const getDatabaseInfo = (): string => {
  const dbUrl = findDatabaseUrl().url;

  try {
    const url = new URL(dbUrl);
    const host = url.hostname;
    const port = url.port || "5432";
    const database = url.pathname.replace("/", "");
    const username = url.username;

    return `postgresql://${username}:***@${host}:${port}/${database}`;
  } catch {
    return "Invalid DATABASE_URL format";
  }
};

/**
 * Connect to the database using Prisma.
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
