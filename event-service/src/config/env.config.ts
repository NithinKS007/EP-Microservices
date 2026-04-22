import "dotenv/config";

interface Env {
  PORT: number;
  SERVICE_NAME: string;

  DATABASE_URL: string;
  NODE_ENV: string;
  BOOKING_SERVICE_URL_GRPC: string;
  PAYMENT_SERVICE_URL_GRPC: string;
  SAGA_SERVICE_URL_GRPC: string;

  KAFKA_BROKERS: string;
  KAFKA_CLIENT_ID: string;
  KAFKA_GROUP_ID: string;
  KAFKA_ENABLED: string;

  EMAIL_USER: string;
  EMAIL_PASS: string;

  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string;
  REDIS_DB: number;

  EVENT_CACHE_PREFIX: string;
  EVENT_CACHE_TTL_SECONDS: number;
}

export const envConfig: Env = {
  PORT: Number(process.env.PORT) || 3000,
  SERVICE_NAME: process.env.SERVICE_NAME || "event-service",

  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/ep_event_service",
  NODE_ENV: process.env.NODE_ENV || "development",
  BOOKING_SERVICE_URL_GRPC: process.env.BOOKING_SERVICE_URL_GRPC || "booking:50053",
  PAYMENT_SERVICE_URL_GRPC: process.env.PAYMENT_SERVICE_URL_GRPC || "payment:50054",
  SAGA_SERVICE_URL_GRPC: process.env.SAGA_SERVICE_URL_GRPC || "saga-orchestrator:50055",

  KAFKA_BROKERS: process.env.KAFKA_BROKERS || "localhost:9092",
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || "event-service",
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || "event-service-group",
  KAFKA_ENABLED: process.env.KAFKA_ENABLED || "false",

  EMAIL_USER: process.env.EMAIL_USER || "email",
  EMAIL_PASS: process.env.EMAIL_PASS || "password",

  REDIS_HOST: process.env.REDIS_HOST || "redis",
  REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || "",
  REDIS_DB: Number(process.env.REDIS_DB) || 0,

  EVENT_CACHE_PREFIX: process.env.EVENT_CACHE_PREFIX || "ep:event:meta",
  EVENT_CACHE_TTL_SECONDS: Number(process.env.EVENT_CACHE_TTL_SECONDS) || 60,
};
