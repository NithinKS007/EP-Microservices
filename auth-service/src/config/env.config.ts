import "dotenv/config";

interface Env {
  PORT: number;
  SERVICE_NAME: string;
  JWT_ACCESS_TOKEN_SECRET: string;
  JWT_ACCESS_TOKEN_EXPIRATION: string;
  JWT_REFRESH_TOKEN_SECRET: string;
  JWT_REFRESH_TOKEN_EXPIRATION: string;

  KAFKA_BROKERS: string;
  KAFKA_CLIENT_ID: string;
  KAFKA_GROUP_ID: string;
  KAFKA_ENABLED: string;

  USER_SERVICE_URL_GRPC: string;

  RT_TTL: number;
  PRT_TTL: number;

  CLIENT_URL: string;

  DATABASE_URL: string;

  EMAIL_USER: string;
  EMAIL_PASS: string;
}

export const envConfig: Env = {
  PORT: Number(process.env.PORT) || 3001,
  SERVICE_NAME: process.env.SERVICE_NAME || "auth-service",
  JWT_ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_TOKEN_SECRET || "secret",
  JWT_ACCESS_TOKEN_EXPIRATION: process.env.JWT_ACCESS_TOKEN_EXPIRATION || "1d",
  JWT_REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_TOKEN_SECRET || "secret",
  JWT_REFRESH_TOKEN_EXPIRATION: process.env.JWT_REFRESH_TOKEN_EXPIRATION || "7d",
  KAFKA_BROKERS: process.env.KAFKA_BROKERS || "kafka:9092",
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || "auth-service",
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || "auth-service-group",
  KAFKA_ENABLED: process.env.KAFKA_ENABLED || "true",

  //GRPC
  USER_SERVICE_URL_GRPC: process.env.USER_SERVICE_URL_GRPC || "user:50051",

  RT_TTL: Number(process.env.RT_TTL) || 7 * 24 * 60 * 60 * 1000,
  PRT_TTL: Number(process.env.PRT_TTL) || 10 * 60 * 1000,

  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:4000",

  DATABASE_URL:
    process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/auth-service",

  EMAIL_USER: process.env.EMAIL_USER || "email",
  EMAIL_PASS: process.env.EMAIL_PASS || "password",
};
