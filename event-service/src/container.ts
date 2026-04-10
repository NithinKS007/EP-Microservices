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
import { CustomMiddleware } from "../../utils/src/auth.middleware";
import { SeatController } from "./controllers/seat.controller";
import { EventService } from "./services/event.service";
import { EventGrpcController } from "./grpc/event.server";
import { BookingServiceGrpcClient } from "./grpc/booking.client";
import { PaymentServiceGrpcClient } from "./grpc/payment.client";
import { SagaServiceGrpcClient } from "./grpc/saga.client";

const container = createContainer();
const clientId = envConfig.KAFKA_CLIENT_ID;
const groupId = envConfig.KAFKA_GROUP_ID;
const brokers = envConfig.KAFKA_BROKERS?.split(",").map((b) => b.trim());
const topics: { topic: string }[] = [];

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
  customMiddleware: asClass(CustomMiddleware).scoped(),
  kafkaService: asClass(KafkaService)
    .scoped()
    .inject(() => ({
      brokers,
      clientId,
      groupId,
      topics,
    })),
  emailService: asClass(EmailService)
    .scoped()
    .inject(() => ({
      emailUser,
      emailPass,
    })),
  tokenService: asClass(TokenService).scoped(),
  eventGrpcController: asClass(EventGrpcController).scoped(),
  bookingServiceGrpcClient: asClass(BookingServiceGrpcClient).scoped(),
  paymentServiceGrpcClient: asClass(PaymentServiceGrpcClient).scoped(),
  sagaServiceGrpcClient: asClass(SagaServiceGrpcClient).scoped(),
});

export { container };
