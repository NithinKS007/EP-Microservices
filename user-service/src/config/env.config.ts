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

  SYSTEM_CODE: string;
}

export const envConfig: Env = {
  PORT: Number(process.env.PORT) || 3000,
  SERVICE_NAME: process.env.SERVICE_NAME || "user-service",

  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:12345@postgres:5432/ep_user_service",
  NODE_ENV: process.env.NODE_ENV || "development",

  KAFKA_BROKERS: process.env.KAFKA_BROKERS || "localhost:9092",
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || "user-service",
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || "user-service-group",
  KAFKA_ENABLED: process.env.KAFKA_ENABLED || "false",
  
  SYSTEM_CODE: process.env.SYSTEM_CODE || "user-service",
};
