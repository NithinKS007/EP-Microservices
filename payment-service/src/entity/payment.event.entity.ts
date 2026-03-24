export interface PaymentEvent {
  id: string;
  paymentId: string;
  type: string;
  payload: Record<string, any>;
  createdAt: Date;
}
