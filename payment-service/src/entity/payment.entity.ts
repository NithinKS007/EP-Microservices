import { PaymentEvent } from "./payment.event.entity";

export enum PaymentStatus {
  INITIATED = "INITIATED",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export interface Payment {
  id: string;
  bookingId: string;
  userId: string;

  amount: number;
  currency: string;

  status: PaymentStatus;

  provider: string;
  providerRef?: string | null;

  paymentEvents?: PaymentEvent[] | null[] | undefined[];

  createdAt: Date;
  updatedAt: Date;
}
