import "dotenv/config";

interface Env {
  PORT: number;
  SERVICE_NAME: string;

  KAFKA_BROKERS: string;
  KAFKA_CLIENT_ID: string;
  KAFKA_GROUP_ID: string;
  KAFKA_ENABLED: string;

  DATABASE_URL: string;
  NODE_ENV: string;

  EVENT_SERVICE_URL_GRPC: string;
  BOOKING_SERVICE_URL_GRPC: string;
  PAYMENT_SERVICE_URL_GRPC: string;
}

export const envConfig: Env = {
  PORT: Number(process.env.PORT) || 3004,
  SERVICE_NAME: process.env.SERVICE_NAME || "saga-orchestrator-service",

  KAFKA_BROKERS: process.env.KAFKA_BROKERS || "kafka:9092",
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || "saga-orchestrator-service",
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || "saga-orchestrator-service-group",
  KAFKA_ENABLED: process.env.KAFKA_ENABLED || "true",

  DATABASE_URL:
    process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/ep_saga_orchestrator_service",
  NODE_ENV: process.env.NODE_ENV || "development",

  EVENT_SERVICE_URL_GRPC: "event:50052",
  BOOKING_SERVICE_URL_GRPC: "booking:50053",
  PAYMENT_SERVICE_URL_GRPC: "payment:50054",
};
