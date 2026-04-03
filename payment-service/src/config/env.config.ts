import "dotenv/config";

interface Env {
  PORT: number;
  SERVICE_NAME: string;
  DATABASE_URL: string;
  KAFKA_BROKERS: string;

  KAFKA_CLIENT_ID: string;
  KAFKA_GROUP_ID: string;
  KAFKA_ENABLED: string;

  NGROK_AUTHTOKEN: string;

  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;

  BOOKING_SERVICE_URL_GRPC: string;
  EVENT_SERVICE_URL_GRPC: string;
  SAGA_SERVICE_URL_GRPC: string;
  USER_SERVICE_URL_GRPC: string;

  EMAIL_USER: string;
  EMAIL_PASS: string;
}

export const envConfig: Env = {
  PORT: Number(process.env.PORT) || 3000,
  SERVICE_NAME: process.env.SERVICE_NAME || "payment-service",
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/postgres",

  KAFKA_BROKERS: process.env.KAFKA_BROKERS || "localhost:9092",
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || "payment-service",
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || "payment-service-group",
  KAFKA_ENABLED: process.env.KAFKA_ENABLED || "false",

  NGROK_AUTHTOKEN: process.env.NGROK_AUTHTOKEN || "1",
  
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "rzp_test_1",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "rzp_test_1",
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "rzp_test_1",
  
  BOOKING_SERVICE_URL_GRPC: process.env.BOOKING_SERVICE_URL_GRPC || "booking:50053",
  EVENT_SERVICE_URL_GRPC: process.env.EVENT_SERVICE_URL_GRPC || "event:50052",
  SAGA_SERVICE_URL_GRPC: process.env.SAGA_SERVICE_URL_GRPC || "saga-orchestrator:50055",
  USER_SERVICE_URL_GRPC: process.env.USER_SERVICE_URL_GRPC || "user:50051",

  EMAIL_USER: process.env.EMAIL_USER || "example@gmail.com",
  EMAIL_PASS: process.env.EMAIL_PASS || "password",
};
