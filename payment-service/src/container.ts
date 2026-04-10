import { createContainer, asClass, asValue } from "awilix";
import { PaymentService } from "./services/payment.service";
import { PaymentRepository } from "./repositories/payment.repository";
import { PaymentEventRepository } from "./repositories/payment.event.repository";
import { KafkaService } from "../../utils/src/kafka.service";
import { envConfig } from "./config/env.config";
import { prisma } from "./utils/dbconfig";
import { PaymentGrpcController } from "./grpc/payment.server";
import { WebhookController } from "./controllers/webhook.controller";
import { OutboxEventRepository } from "./repositories/outbox.event.repository";
import { OutboxWorker } from "./utils/outbox.worker";
import { PaymentEventConsumer } from "./utils/payment.event.consumer";
import { BookingServiceGrpcClient } from "./grpc/booking.client";
import { EventServiceGrpcClient } from "./grpc/event.client";
import { UserServiceGrpcClient } from "./grpc/user.client";
import { CustomMiddleware, EmailService } from "../../utils/src";
import { PaymentController } from "./controllers/payment.controller";
import { UnitOfWork } from "./repositories/unity.of.work";
import { SagaServiceGrpcClient } from "./grpc/saga.client";

const container = createContainer();
const clientId = envConfig.KAFKA_CLIENT_ID;
const groupId = envConfig.KAFKA_GROUP_ID;
const brokers = envConfig.KAFKA_BROKERS?.split(",").map((b) => b.trim());
const topics = [
  { topic: "payment.success" },
  { topic: "payment.failed" },
  { topic: "payment.refunded" },
  { topic: "payment.success.dlq" },
  { topic: "payment.failed.dlq" },
  { topic: "payment.refunded.dlq" },
];

container.register({
  prisma: asValue(prisma),
});

container.register({
  paymentService: asClass(PaymentService).scoped(),

  paymentRepository: asClass(PaymentRepository).scoped(),
  paymentEventRepository: asClass(PaymentEventRepository).scoped(),
  outboxEventRepository: asClass(OutboxEventRepository).scoped(),
  unitOfWork: asClass(UnitOfWork).scoped(),

  kafkaService: asClass(KafkaService)
    .scoped()
    .inject(() => ({
      brokers,
      clientId,
      groupId,
      topics,
    })),

  paymentGrpcController: asClass(PaymentGrpcController).scoped(),
  webhookController: asClass(WebhookController).scoped(),
  paymentController: asClass(PaymentController).scoped(),
  sagaServiceGrpcClient: asClass(SagaServiceGrpcClient).scoped(),
  bookingServiceGrpcClient: asClass(BookingServiceGrpcClient).scoped(),
  eventServiceGrpcClient: asClass(EventServiceGrpcClient).scoped(),
  userServiceGrpcClient: asClass(UserServiceGrpcClient).scoped(),

  emailService: asClass(EmailService)
    .scoped()
    .inject(() => ({
      emailUser: envConfig.EMAIL_USER,
      emailPass: envConfig.EMAIL_PASS,
    })),

  outboxWorker: asClass(OutboxWorker).scoped(),

  paymentEventConsumer: asClass(PaymentEventConsumer).scoped(),
  customMiddleware: asClass(CustomMiddleware).scoped(),
});

export { container };
