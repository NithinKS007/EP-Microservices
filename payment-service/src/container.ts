import { createContainer, asClass, asValue } from "awilix";
import { PaymentService } from "./services/payment.service";
import { PaymentRepository } from "./repositories/payment.repository";
import { PaymentEventRepository } from "repositories/payment.event.repository";
import { KafkaService } from "../../utils/src/kafka.service";
import { envConfig } from "./config/env.config";
import { prisma } from "./utils/dbconfig";
import { PaymentGrpcController } from "./grpc/payment.server";
import { WebhookController } from "./controllers/webhook.controller";
import { OutboxEventRepository } from "./repositories/outbox.event.repository";
import { OutboxWorker } from "./utils/outbox.worker";
import { PaymentSuccessConsumer } from "./utils/payment.success.consumer";
import { PaymentFailedConsumer } from "./utils/payment.failed.consumer";
import { CustomMiddleware } from "../../utils/src";

const container = createContainer();
const clientId = envConfig.KAFKA_CLIENT_ID;
const groupId = envConfig.KAFKA_GROUP_ID;
const brokers = envConfig.KAFKA_BROKERS?.split(",").map((b) => b.trim());

container.register({
  prisma: asValue(prisma),
});

container.register({
  paymentService: asClass(PaymentService).scoped(),

  paymentRepository: asClass(PaymentRepository).scoped(),
  paymentEventRepository: asClass(PaymentEventRepository).scoped(),
  outboxEventRepository: asClass(OutboxEventRepository).scoped(),

  kafkaService: asClass(KafkaService)
    .scoped()
    .inject(() => ({
      brokers,
      clientId,
      groupId,
    })),

  paymentGrpcController: asClass(PaymentGrpcController).scoped(),
  webhookController: asClass(WebhookController).scoped(),

  outboxWorker: asClass(OutboxWorker).scoped(),

  paymentSuccessConsumer: asClass(PaymentSuccessConsumer).scoped(),
  paymentFailedConsumer: asClass(PaymentFailedConsumer).scoped(),
  customMiddleware: asClass(CustomMiddleware).scoped(),
});

export { container };
