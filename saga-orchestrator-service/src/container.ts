import { createContainer, asClass, asValue } from "awilix";
import { envConfig } from "./config/env.config";
import { CustomMiddleware, KafkaService, CronRunner } from "../../utils/src";
import { SagaService } from "./services/saga.service";
import { SagaRecoveryJob } from "./utils/saga.recovery.job";
import { SagaRepository } from "./repositories/saga.repository";
import { SagaStepRepository } from "./repositories/saga.step.repository";
import { UnitOfWork } from "./repositories/unity.of.work";
import { prisma } from "./utils/dbconfig";
import { BookingServiceGrpcClient } from "./grpc/booking.client";
import { PaymentServiceGrpcClient } from "./grpc/payment.client";
import { EventServiceGrpcClient } from "./grpc/event.client";
import { OutboxEventRepository } from "./repositories/outbox.event.repository";
import { OutboxWorker } from "./utils/outbox.worker";
import { CancelEventSagaConsumer } from "./utils/cancel.event.saga.consumer";
import { SagaGrpcController } from "./grpc/saga.server";
const container = createContainer();

const clientId = envConfig.KAFKA_CLIENT_ID;
const groupId = envConfig.KAFKA_GROUP_ID;
const brokers = envConfig.KAFKA_BROKERS?.split(",").map((b) => b.trim());

container.register({
  prisma: asValue(prisma),
  kafkaService: asClass(KafkaService)
    .scoped()
    .inject(() => ({
      brokers,
      clientId,
      groupId,
    })),
  sagaService: asClass(SagaService).scoped(),

  sagaRepository: asClass(SagaRepository).scoped(),
  sagaStepRepository: asClass(SagaStepRepository).scoped(),
  outboxEventRepository: asClass(OutboxEventRepository).scoped(),
  unitOfWork: asClass(UnitOfWork).scoped(),
  bookingServiceGrpcClient: asClass(BookingServiceGrpcClient).scoped(),
  paymentServiceGrpcClient: asClass(PaymentServiceGrpcClient).scoped(),
  eventServiceGrpcClient: asClass(EventServiceGrpcClient).scoped(),
  outboxWorker: asClass(OutboxWorker).scoped(),
  cronRunner: asClass(CronRunner).scoped(),
  sagaRecoveryJob: asClass(SagaRecoveryJob).scoped(),
  cancelEventSagaConsumer: asClass(CancelEventSagaConsumer).scoped(),
  sagaGrpcController: asClass(SagaGrpcController).scoped(),
  customMiddleware: asClass(CustomMiddleware).scoped(),
});

export { container };
