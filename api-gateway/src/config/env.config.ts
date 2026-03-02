import "dotenv/config";

interface Env {
  PORT: number;
  SERVICE_NAME: string;
  DEFAULT_TIMEOUT: number;

  AUTH_SERVICE_URL: string;
  USER_SERVICE_URL: string;
  EVENT_SERVICE_URL: string;

  CLIENT_URL: string;

  JWT_ACCESS_TOKEN_SECRET: string;
  JWT_ACCESS_TOKEN_EXPIRATION: string;
  JWT_REFRESH_TOKEN_SECRET: string;
  JWT_REFRESH_TOKEN_EXPIRATION: string;
}

export const envConfig: Env = {
  PORT: Number(process.env.PORT) || 3000,
  SERVICE_NAME: process.env.SERVICE_NAME || "api-gateway",
  DEFAULT_TIMEOUT: Number(process.env.DEFAULT_TIMEOUT) || 5000,
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
  USER_SERVICE_URL: process.env.USER_SERVICE_URL || "http://localhost:3002",
  EVENT_SERVICE_URL: process.env.EVENT_SERVICE_URL || "http://localhost:3003",
  
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",

  JWT_ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_TOKEN_SECRET || "secret",
  JWT_ACCESS_TOKEN_EXPIRATION: process.env.JWT_ACCESS_TOKEN_EXPIRATION ||"1d",
  JWT_REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_TOKEN_SECRET || "secret",
  JWT_REFRESH_TOKEN_EXPIRATION: process.env.JWT_REFRESH_TOKEN_EXPIRATION || "7d",
};
