export interface Seat {
  id: string;
  eventId: string;

  seatNumber: string;

  seatTier: "VIP" | "REGULAR" | "ECONOMY";

  price: string;

  seatStatus: "AVAILABLE" | "LOCKED" | "SOLD";

  lockExpiresAt?: Date | null;

  event?: Event;

  createdAt: Date;
  updatedAt: Date;
}