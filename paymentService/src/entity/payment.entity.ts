import { PaymentEvent } from "./payment.event.entity";

export enum PaymentStatus {
  initiated = "initiated",
  success = "success",
  failed = "failed",
  refunded = "refunded",
}

export interface Payment {
  id: string;
  bookingId: string;
  userId: string;

  amount: number;
  currency: string;

  status: PaymentStatus;

  provider: string;
  providerRef?: string;

  paymentEvents?: PaymentEvent[];

  createdAt: Date;
  updatedAt: Date;
}
