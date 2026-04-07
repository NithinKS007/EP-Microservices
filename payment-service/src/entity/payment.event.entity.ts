export interface PaymentEvent {
  id: string;
  paymentId?: string | null;
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}
