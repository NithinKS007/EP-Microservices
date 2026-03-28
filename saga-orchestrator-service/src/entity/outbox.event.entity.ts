export interface OutboxEvent {
  id: string;
  topic: string;
  payload: unknown;
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  retryCount: number;
  nextRetryAt: Date;
  processedAt?: Date | null;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
