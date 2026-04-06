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

export class KafkaService {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly consumer: Consumer;
  private readonly groupId: string;

  constructor({
    clientId,
    groupId,
    brokers,
  }: {
    clientId: string;
    groupId: string;
    brokers: string[];
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

    this.kafka = new Kafka({
      clientId,
      brokers,
    });

    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId });
  }

  async connectProducer(): Promise<void> {
    await this.producer.connect();
    logger.info(`[Kafka] Producer connected`);
  }

  async connectConsumer(): Promise<void> {
    await this.consumer.connect();
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

    await this.producer.send(record);
    logger.info(`[Kafka] Published to ${topic}: ${JSON.stringify(message)}`);
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
        }
      },
    });
  }
}
