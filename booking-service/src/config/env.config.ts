import "dotenv/config";

interface Env {
  PORT: number;
  SERVICE_NAME: string;
  DATABASE_URL: string;
  KAFKA_BROKERS: string;
  KAFKA_CLIENT_ID: string;
  KAFKA_GROUP_ID: string;
  KAFKA_ENABLED: string;
}

export const envConfig: Env = {
  PORT: Number(process.env.PORT) || 3000,
  SERVICE_NAME: process.env.SERVICE_NAME || "booking-service",
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/postgres",
  KAFKA_BROKERS: process.env.KAFKA_BROKERS || "localhost:9092",
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || "booking-service",
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || "booking-service-group",
  KAFKA_ENABLED: process.env.KAFKA_ENABLED || "false",
};
