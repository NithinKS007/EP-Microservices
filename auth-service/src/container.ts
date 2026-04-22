import { createContainer, asClass, asValue } from "awilix";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.service";
import {
  KafkaService,
  JwtService,
  TokenService,
  CronRunner,
  EmailService,
  CustomMiddleware,
  RedisService,
  RateLimiter,
} from "../../utils/src";
import { envConfig } from "./config/env.config";
import { UserServiceGrpcClient } from "./grpc/user.client";
import { RefreshTokenRepository } from "./repositories/refresh.token.repository";
import { TokenCleanupJob } from "./utils/cronjob";
import { PasswordController } from "./controllers/password.controller";
import { PasswordService } from "./services/password.service";
import { PasswordResetTokenRepository } from "./repositories/password.token.repository";
import { prisma } from "./utils/dbconfig";
import { EmailAvailabilityService } from "./services/email.availability.service";

const container = createContainer();
const clientId = envConfig.KAFKA_CLIENT_ID;
const groupId = envConfig.KAFKA_GROUP_ID;
const brokers = envConfig.KAFKA_BROKERS?.split(",").map((b) => b.trim());
const topics: { topic: string }[] = [];

const accessSecret = envConfig.JWT_ACCESS_TOKEN_SECRET;
const refreshSecret = envConfig.JWT_REFRESH_TOKEN_SECRET;
const accessExpiration = envConfig.JWT_ACCESS_TOKEN_EXPIRATION;
const refreshExpiration = envConfig.JWT_REFRESH_TOKEN_EXPIRATION;

const emailUser = envConfig.EMAIL_USER;
const emailPass = envConfig.EMAIL_PASS;

const redisHost = envConfig.REDIS_HOST;
const redisPort = envConfig.REDIS_PORT;
const redisPassword = envConfig.REDIS_PASSWORD;
const redisDb = envConfig.REDIS_DB;

container.register({
  prisma: asValue(prisma),
});

container.register({
  authService: asClass(AuthService).scoped(),
  passwordService: asClass(PasswordService).scoped(),
  emailAvailabilityService: asClass(EmailAvailabilityService).scoped(),
  authController: asClass(AuthController).scoped(),
  passwordController: asClass(PasswordController).scoped(),

  kafkaService: asClass(KafkaService)
    .scoped()
    .inject(() => ({
      brokers,
      clientId,
      groupId,
      topics,
    })),
  jwtService: asClass(JwtService)
    .scoped()
    .inject(() => ({
      accessSecret,
      refreshSecret,
      accessExpiration,
      refreshExpiration,
    })),
  userServiceGrpcClient: asClass(UserServiceGrpcClient).scoped(),
  refreshTokenRepository: asClass(RefreshTokenRepository).scoped(),
  passwordResetTokenRepository: asClass(PasswordResetTokenRepository).scoped(),
  tokenService: asClass(TokenService).scoped(),
  cronRunner: asClass(CronRunner)
    .scoped()
    .inject(() => ({
      serviceName: envConfig.SERVICE_NAME,
    })),
  tokenCleanupJob: asClass(TokenCleanupJob).scoped(),
  emailService: asClass(EmailService)
    .scoped()
    .inject(() => ({
      emailUser,
      emailPass,
    })),
  redisService: asClass(RedisService)
    .singleton()
    .inject(() => ({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      db: redisDb,
    })),
  rateLimiter: asClass(RateLimiter).singleton(),
  customMiddleware: asClass(CustomMiddleware).scoped(),
});

export { container };
