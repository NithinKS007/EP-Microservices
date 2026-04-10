export interface OutboxEvent {
  id: string;
  topic: string;
  payload: unknown;
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  retryCount: number;
  nextRetryAt: Date;
  error?: string | null;
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
