import { Seat } from "./seat.entity";

export interface Event {
  id: string;
  name: string;
  description?: string;

  venueName: string;
  eventDate: Date;

  status: "ACTIVE" | "CANCELLED";

  seats?: Seat[];

  createdAt: Date;
  updatedAt: Date;
}
