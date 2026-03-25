import { createContainer, asClass, asValue } from "awilix";
import { UserService } from "./services/user.service";
import { UserRepository } from "./repositories/user.repository";
import { KafkaService } from "../../utils/src/kafka.service";
import { UserController } from "./controllers/user.controller";
import { envConfig } from "./config/env.config";
import { prisma } from "./utils/dbconfig";
import { UserGrpcController } from "./grpc/user.server";
import { CustomMiddleware } from "../../utils/src";

const container = createContainer();
const clientId = envConfig.KAFKA_CLIENT_ID;
const groupId = envConfig.KAFKA_GROUP_ID;
const brokers = envConfig.KAFKA_BROKERS?.split(",").map((b) => b.trim());

container.register({
  prisma: asValue(prisma),
});

container.register({
  userService: asClass(UserService).scoped(),
  userRepository: asClass(UserRepository).scoped(),
  kafkaService: asClass(KafkaService)
    .scoped()
    .inject(() => ({
      brokers,
      clientId,
      groupId,
    })),
  userController: asClass(UserController).scoped(),
  userGrpcController: asClass(UserGrpcController).scoped(),
  customMiddleware: asClass(CustomMiddleware).scoped(),
});

export { container };
