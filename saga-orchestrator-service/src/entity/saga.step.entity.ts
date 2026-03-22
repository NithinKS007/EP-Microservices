export interface ISagaStep {
  id: string;
  sagaId: string;

  stepName: string;
  stepOrder: number;

  status: StepStatus;
  retryCount: number;

  errorMessage?: string | null;

  startedAt?: Date | null;
  completedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export enum StepStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  COMPENSATING = "compensating",
  COMPENSATED = "compensated",
  SKIPPED = "skipped",
}