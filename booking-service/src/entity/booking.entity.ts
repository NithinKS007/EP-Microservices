import { BookingSeat } from "./booking.seat.entity";

export enum BookingStatus {
  PENDING = "PENDING",
  PAYMENT_INITIATED = "PAYMENT_INITIATED",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

export interface Booking {
  id: string;
  userId: string;
  eventId: string;
  status: BookingStatus;
  totalAmount: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;

  bookingSeats?: BookingSeat[];
}
