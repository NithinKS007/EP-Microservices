import { createContainer, asClass, asValue } from "awilix";
import { BookingService } from "./services/booking.service";
import { BookingRepository } from "./repositories/booking.repository";
import { BookingSeatRepository } from "repositories/booking.seat.repository";
import { KafkaService } from "../../utils/src/kafka.service";
import { BookingController } from "./controllers/booking.controller";
import { envConfig } from "./config/env.config";
import { prisma } from "./utils/dbconfig";
import { BookingGrpcController } from "./grpc/booking.server";
import { CronRunner, CustomMiddleware } from "../../utils/src";
import { UnitOfWork } from "./repositories/unity.of.work";
import { OutboxEventRepository } from "./repositories/outbox.event.repository";
import { OutboxWorker } from "./utils/outbox.worker";
import { EventServiceGrpcClient } from "./grpc/event.client";
import { BookingExpiryJob } from "./utils/booking.expiry.job";
import { PaymentServiceGrpcClient } from "./grpc/payment.client";

const container = createContainer();
const clientId = envConfig.KAFKA_CLIENT_ID;
const groupId = envConfig.KAFKA_GROUP_ID;
const brokers = envConfig.KAFKA_BROKERS?.split(",").map((b) => b.trim());

container.register({
  prisma: asValue(prisma),
});

container.register({
  bookingService: asClass(BookingService).scoped(),

  bookingRepository: asClass(BookingRepository).scoped(),
  bookingSeatRepository: asClass(BookingSeatRepository).scoped(),
  outboxEventRepository: asClass(OutboxEventRepository).scoped(),
  unitOfWork: asClass(UnitOfWork).scoped(),

  kafkaService: asClass(KafkaService)
    .scoped()
    .inject(() => ({
      brokers,
      clientId,
      groupId,
    })),

  bookingController: asClass(BookingController).scoped(),
  bookingGrpcController: asClass(BookingGrpcController).scoped(),
  outboxWorker: asClass(OutboxWorker).scoped(),
  eventServiceGrpcClient: asClass(EventServiceGrpcClient).scoped(),
  paymentServiceGrpcClient: asClass(PaymentServiceGrpcClient).scoped(),
  cronRunner: asClass(CronRunner).scoped(),
  bookingExpiryJob: asClass(BookingExpiryJob).scoped(),
  customMiddleware: asClass(CustomMiddleware).scoped(),
});

export { container };
