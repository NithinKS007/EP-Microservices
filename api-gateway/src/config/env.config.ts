import "dotenv/config";

interface Env {
  PORT: number;
  SERVICE_NAME: string;
  DEFAULT_TIMEOUT: number;

  AUTH_SERVICE_URL: string;
  USER_SERVICE_URL: string;
  EVENT_SERVICE_URL: string;
  BOOKING_SERVICE_URL: string;
  PAYMENT_SERVICE_URL: string;
  SAGA_ORCHESTRATOR_SERVICE_URL: string;

  CLIENT_URL: string;

  JWT_ACCESS_TOKEN_SECRET: string;
  JWT_ACCESS_TOKEN_EXPIRATION: string;
  JWT_REFRESH_TOKEN_SECRET: string;
  JWT_REFRESH_TOKEN_EXPIRATION: string;
 
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string;
  REDIS_DB: number;
}

export const envConfig: Env = {
  PORT: Number(process.env.PORT) || 3000,
  SERVICE_NAME: process.env.SERVICE_NAME || "api-gateway",
  DEFAULT_TIMEOUT: Number(process.env.DEFAULT_TIMEOUT) || 5000,

  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
  USER_SERVICE_URL: process.env.USER_SERVICE_URL || "http://localhost:3002",
  EVENT_SERVICE_URL: process.env.EVENT_SERVICE_URL || "http://localhost:3003",
  BOOKING_SERVICE_URL: process.env.BOOKING_SERVICE_URL || "http://localhost:3004",
  PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL || "http://localhost:3005",
  SAGA_ORCHESTRATOR_SERVICE_URL: process.env.SAGA_ORCHESTRATOR_SERVICE_URL || "http://localhost:3006",

  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",

  JWT_ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_TOKEN_SECRET || "secret",
  JWT_ACCESS_TOKEN_EXPIRATION: process.env.JWT_ACCESS_TOKEN_EXPIRATION || "1d",
  JWT_REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_TOKEN_SECRET || "secret",
  JWT_REFRESH_TOKEN_EXPIRATION: process.env.JWT_REFRESH_TOKEN_EXPIRATION || "7d",
 
  REDIS_HOST: process.env.REDIS_HOST || "redis",
  REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || "password",
  REDIS_DB: Number(process.env.REDIS_DB) || 0,
};
