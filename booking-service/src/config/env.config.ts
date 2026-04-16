import "dotenv/config";

interface Env {
  PORT: number;
  SERVICE_NAME: string;
  DATABASE_URL: string;
  NODE_ENV: string;

  KAFKA_BROKERS: string;
  KAFKA_CLIENT_ID: string;
  KAFKA_GROUP_ID: string;
  KAFKA_ENABLED: string;

  EVENT_SERVICE_URL_GRPC: string;
  PAYMENT_SERVICE_URL_GRPC: string;
}

export const envConfig: Env = {
  PORT: Number(process.env.PORT) || 3000,
  SERVICE_NAME: process.env.SERVICE_NAME || "booking-service",
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:12345@postgres:5432/ep_booking_service",
  NODE_ENV: process.env.NODE_ENV || "development",

  KAFKA_BROKERS: process.env.KAFKA_BROKERS || "localhost:9092",
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || "booking-service",
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || "booking-service-group",
  KAFKA_ENABLED: process.env.KAFKA_ENABLED || "false",

  EVENT_SERVICE_URL_GRPC: process.env.EVENT_SERVICE_URL_GRPC || "event:50052",
  PAYMENT_SERVICE_URL_GRPC: process.env.PAYMENT_SERVICE_URL_GRPC || "payment:50052",
};
