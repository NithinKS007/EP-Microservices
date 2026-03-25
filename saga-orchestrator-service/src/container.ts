import { createContainer, asClass } from "awilix";
import { envConfig } from "./config/env.config";
import { CustomMiddleware, KafkaService } from "../../utils/src";
import { SagaService } from "./services/saga.service";
import { SagaRepository } from "./repositories/saga.repository";
import { SagaStepRepository } from "./repositories/saga.step.repository";
import { UnitOfWork } from "./repositories/unity.of.work";
const container = createContainer();

const clientId = envConfig.KAFKA_CLIENT_ID;
const groupId = envConfig.KAFKA_GROUP_ID;
const brokers = envConfig.KAFKA_BROKERS?.split(",").map((b) => b.trim());

container.register({
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
  unityOfWork: asClass(UnitOfWork).scoped(),
  customMiddleware: asClass(CustomMiddleware).scoped(),
});

export { container };
