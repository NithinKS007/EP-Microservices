export interface PaymentEvent {
  id: string;
  paymentId?: string | null;
  type: string;
  payload: Record<string, any>;
  createdAt: Date;
}
