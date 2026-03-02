import "dotenv/config";

interface Env {
  PORT: number;
  SERVICE_NAME: string;

  DATABASE_URL: string;

  KAFKA_BROKERS: string;
  KAFKA_CLIENT_ID: string;
  KAFKA_GROUP_ID: string;
  KAFKA_ENABLED: string;

  EMAIL_USER: string;
  EMAIL_PASS: string;
}

export const envConfig: Env = {
  PORT: Number(process.env.PORT) || 3000,
  SERVICE_NAME: process.env.SERVICE_NAME || "event-service",

  DATABASE_URL:
    process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres",

  KAFKA_BROKERS: process.env.KAFKA_BROKERS || "localhost:9092",
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || "event-service",
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || "event-service-group",
  KAFKA_ENABLED: process.env.KAFKA_ENABLED || "false",

  EMAIL_USER: process.env.EMAIL_USER || "email",
  EMAIL_PASS: process.env.EMAIL_PASS || "password",
};
