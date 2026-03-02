import { createContainer, asClass, asValue } from "awilix";
import { EventRepository } from "./repositories/event.repository";
import { KafkaService } from "../../utils/src/kafka.service";
import { EventController } from "./controllers/event.controller";
import { envConfig } from "./config/env.config";
import { prisma } from "./utils/dbconfig";
import { SeatService } from "./services/seat.service";
import { SeatRepository } from "./repositories/seat.repository";
import { EmailService, TokenService } from "../../utils/src";
import { UnitOfWork } from "./repositories/unity.of.work";
import { AuthMiddleware } from "../../utils/src/auth.middleware";
import { SeatController } from "./controllers/seat.controller";
import { EventService } from "./services/event.service";

const container = createContainer();
const clientId = envConfig.KAFKA_CLIENT_ID;
const groupId = envConfig.KAFKA_GROUP_ID;
const brokers = envConfig.KAFKA_BROKERS?.split(",").map((b) => b.trim());

const emailUser = envConfig.EMAIL_USER;
const emailPass = envConfig.EMAIL_PASS;

container.register({
  prisma: asValue(prisma),
});

container.register({
  // Services
  eventService: asClass(EventService).scoped(),
  seatService: asClass(SeatService).scoped(),

  // Utils

  // Repositories
  eventRepository: asClass(EventRepository).scoped(),
  seatRepository: asClass(SeatRepository).scoped(),
  unitOfWork: asClass(UnitOfWork).scoped(),

  // Controllers
  eventController: asClass(EventController).scoped(),
  seatController: asClass(SeatController).scoped(),

  // Utils
  authMidUtils: asClass(AuthMiddleware).scoped(),
  kafkaService: asClass(KafkaService)
    .scoped()
    .inject(() => ({
      brokers,
      clientId,
      groupId,
    })),
  emailService: asClass(EmailService)
    .scoped()
    .inject(() => ({
      emailUser,
      emailPass,
    })),
  tokenService: asClass(TokenService).scoped(),
});

export { container };
