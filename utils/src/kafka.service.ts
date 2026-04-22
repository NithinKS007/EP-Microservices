import { Kafka, EachMessagePayload, ProducerRecord, Message, Producer, Consumer } from "kafkajs";
import { logger } from "./logger";

/**
 * Kafka configuration module.
 *
 * This module:
 * - Reads Kafka environment variables
 * - Validates required Kafka config
 * - Initializes and exports a Kafka client connection
 * - Exports useful identifiers (CLIENT_ID, GROUP_ID, BROKERS)
 *
 * @module kafka.config
 *
 * @constant {string} CLIENT_ID - Unique Kafka client identifier for this service.
 * @constant {string} GROUP_ID - Kafka consumer group identifier.
 * @constant {string[]} BROKERS - List of Kafka broker URLs parsed from env.
 * @constant {Kafka} kafkaConnect - Kafka instance used to create producers & consumers.
 */

export interface PublishMessageParams<T> {
  topic: string;
  message: T;
}

export interface MessageHandler<T> {
  (payload: T): Promise<void>;
}

export interface KafkaTopicConfig {
  topic: string;
  numPartitions?: number;
  replicationFactor?: number;
}

export class KafkaService {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly consumer: Consumer;
  private readonly groupId: string;
  private readonly topics: KafkaTopicConfig[];
  private producerConnected = false;
  private consumerConnected = false;

  constructor({
    clientId,
    groupId,
    brokers,
    topics = [],
  }: {
    clientId: string;
    groupId: string;
    brokers: string[];
    topics?: KafkaTopicConfig[];
  }) {
    if (!brokers || brokers.length === 0) {
      throw new Error("Kafka brokers are required");
    }

    if (!clientId) {
      throw new Error("Kafka client ID is required");
    }

    if (!groupId) {
      throw new Error("Kafka group ID is required");
    }

    this.groupId = groupId;
    this.topics = topics;

    this.kafka = new Kafka({
      clientId,
      brokers,
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      idempotent: true,
    });

    this.consumer = this.kafka.consumer({
      groupId,
      allowAutoTopicCreation: false,
    });

    this.consumer.on(this.consumer.events.CRASH, (event) => {
      const payload = event.payload as { error?: unknown; restart?: boolean };
      logger.error(
        `[Kafka] Consumer crashed (groupId=${this.groupId}, restart=${payload.restart ?? false})`,
        payload.error,
      );
    });

    this.consumer.on(this.consumer.events.DISCONNECT, () => {
      logger.warn(`[Kafka] Consumer disconnected (groupId=${this.groupId})`);
    });
  }

  async ensureTopics(): Promise<void> {
    if (this.topics.length === 0) {
      logger.info("[Kafka] No topics configured for bootstrap");
      return;
    }

    const admin = this.kafka.admin();

    try {
      await admin.connect();

      const existingTopics = new Set(await admin.listTopics());
      const missingTopics = this.topics.filter(({ topic }) => !existingTopics.has(topic));

      if (missingTopics.length === 0) {
        logger.info(`[Kafka] No missing topics found for bootstrap: ${this.topics.map(({ topic }) => topic)}`);
        logger.info("[Kafka] Required topics already exist");
        return;
      }

      await admin.createTopics({
        waitForLeaders: true,
        topics: missingTopics.map((topicConfig) => ({
          topic: topicConfig.topic,
          numPartitions: topicConfig.numPartitions ?? 1,
          replicationFactor: topicConfig.replicationFactor ?? 1,
        })),
      });

      logger.info(`[Kafka] Ensured topics: ${missingTopics.map(({ topic }) => topic).join(", ")}`);
    } finally {
      try {
        await admin.disconnect();
      } catch (error) {
        logger.warn(
          `[Kafka] Failed to disconnect admin client: ${
            error instanceof Error ? error.message : JSON.stringify(error)
          }`,
        );
      }
    }
  }

  async connectProducer(): Promise<void> {
    if (this.producerConnected) {
      return;
    }

    await this.producer.connect();
    this.producerConnected = true;
    logger.info(`[Kafka] Producer connected`);
  }

  async connectConsumer(): Promise<void> {
    if (this.consumerConnected) {
      return;
    }

    await this.consumer.connect();
    this.consumerConnected = true;
    logger.info(`[Kafka] Consumer connected (groupId=${this.groupId})`);
  }

  async publishMessage<T>(params: PublishMessageParams<T>): Promise<void> {
    const { topic, message } = params;
    const payload: Message = {
      value: JSON.stringify(message),
    };
    const record: ProducerRecord = {
      topic,
      messages: [payload],
    };

    await this.producer.send({
      ...record,
      acks: -1,
    });
    logger.info(`[Kafka] Published to ${topic}: ${JSON.stringify(message)}`);
  }

  async disconnect(): Promise<void> {
    const disconnectTasks: Promise<void>[] = [];

    if (this.consumerConnected) {
      disconnectTasks.push(this.consumer.disconnect());
    }

    if (this.producerConnected) {
      disconnectTasks.push(this.producer.disconnect());
    }

    const results = await Promise.allSettled(disconnectTasks);

    this.consumerConnected = false;
    this.producerConnected = false;

    for (const result of results) {
      if (result.status === "rejected") {
        logger.warn(
          `[Kafka] Disconnect warning: ${
            result.reason instanceof Error ? result.reason.message : JSON.stringify(result.reason)
          }`,
        );
      }
    }
  }

  async consumeMessages<T>(data: { topic: string; handler: MessageHandler<T> }): Promise<void> {
    const { topic, handler } = data;
    await this.consumer.subscribe({ topic, fromBeginning: false });
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        try {
          if (!message?.value) {
            logger.warn("Kafka message value is empty or null.");
            return;
          }
          const parsed: T = JSON.parse(message.value.toString());
          await handler(parsed);
        } catch (err) {
          logger.error(
            `[Kafka Consumer] Error processing message on topic "${topic}" [partition ${partition}]`,
            err,
          );
          throw err;
        }
      },
    });
    logger.info(`[Kafka] Subscribed to topic: ${topic}`);
  }

  async consumeEvents<T>(
    consumers: { topic: string; handler: MessageHandler<T> }[],
  ): Promise<void> {
    for (const { topic } of consumers) {
      await this.consumer.subscribe({ topic, fromBeginning: false });
      logger.info(`[Kafka] Subscribed to topic: ${topic}`);
    }

    await this.consumer.run({
      eachMessage: async ({ topic, partition: _partition, message }: EachMessagePayload) => {
        try {
          if (!message?.value) return;
          const parsed = JSON.parse(message.value.toString());
          const match = consumers.find((c) => c.topic === topic);
          if (match) {
            await match.handler(parsed);
          }
        } catch (err) {
          logger.error(`[Kafka Consumer] Error on topic "${topic}"`, err);
          throw err;
        }
      },
    });
  }
}
