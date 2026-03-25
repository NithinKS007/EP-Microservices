import { createContainer, asClass, asValue } from "awilix";
import { BookingService } from "./services/booking.service";
import { BookingRepository } from "./repositories/booking.repository";
import { BookingSeatRepository } from "repositories/booking.seat.repository";
import { KafkaService } from "../../utils/src/kafka.service";
import { BookingController } from "./controllers/booking.controller";
import { envConfig } from "./config/env.config";
import { prisma } from "./utils/dbconfig";
import { BookingGrpcController } from "./grpc/booking.server";
import { CustomMiddleware } from "../../utils/src";

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

  kafkaService: asClass(KafkaService)
    .scoped()
    .inject(() => ({
      brokers,
      clientId,
      groupId,
    })),

  bookingController: asClass(BookingController).scoped(),
  bookingGrpcController: asClass(BookingGrpcController).scoped(),
  customMiddleware: asClass(CustomMiddleware).scoped(),
});

export { container };
