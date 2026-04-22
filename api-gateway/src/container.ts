import { createContainer, asClass } from "awilix";
import { JwtService ,  RateLimiter,  RedisService,} from "../../utils/src";
import { envConfig } from "./config/env.config";

const container = createContainer();

const accessSecret = envConfig.JWT_ACCESS_TOKEN_SECRET;
const refreshSecret = envConfig.JWT_REFRESH_TOKEN_SECRET;
const accessExpiration = envConfig.JWT_ACCESS_TOKEN_EXPIRATION;
const refreshExpiration = envConfig.JWT_REFRESH_TOKEN_EXPIRATION;

const redisHost = envConfig.REDIS_HOST;
const redisPort = envConfig.REDIS_PORT;
const redisPassword = envConfig.REDIS_PASSWORD;
const redisDb = envConfig.REDIS_DB;

container.register({
  jwtService: asClass(JwtService)
    .scoped()
    .inject(() => ({
      accessSecret,
      refreshSecret,
      accessExpiration,
      refreshExpiration,
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
});

export { container };
