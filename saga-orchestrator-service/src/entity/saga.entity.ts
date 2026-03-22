import { ISagaStep } from "./saga.step.entity";

export interface ISaga {
  id: string;

  sagaType: string;        // ex: BOOKING_SAGA
  referenceId: string;     // ex: bookingId

  status: SagaStatus;
  currentStep?: string | null;

  retryCount: number;
  errorMessage?: string | null;

  steps: ISagaStep[];

  createdAt: Date;
  updatedAt: Date;
}

export enum SagaStatus {
  STARTED = "started",
  IN_PROGRESS = "in_progress",
  COMPENSATING = "compensating",
  COMPLETED = "completed",
  FAILED = "failed",
  COMPENSATED = "compensated",
  TIMEOUT = "timeout",
}
