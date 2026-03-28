export interface OutboxEvent {
  id: string;
  topic: string;
  payload: any;
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  retryCount: number;
  nextRetryAt: Date;
  error?: string | null;
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
