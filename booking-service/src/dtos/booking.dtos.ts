import { IsUUID, IsArray, ArrayNotEmpty, IsNumber, Min, ValidateNested } from "class-validator";

import { Type } from "class-transformer";

export class SeatSelectionDTO {
  @IsUUID("4", { message: "seatId must be a valid UUID" })
  id!: string;

  @IsNumber({}, { message: "price must be a number" })
  @Min(0, { message: "price must be greater than or equal to 0" })
  price!: number;
}

export class CreateBookingDto {
  @IsUUID("4", { message: "Event ID must be a valid UUID" })
  eventId!: string;

  @IsUUID("4", { message: "User ID must be a valid UUID" })
  userId!: string;

  @IsNumber()
  totalAmount!: number;

  @IsArray({ message: "seats must be an array" })
  @ArrayNotEmpty({ message: "At least one seat must be selected" })
  @ValidateNested({ each: true })
  @Type(() => SeatSelectionDTO)
  seats!: SeatSelectionDTO[];
}
