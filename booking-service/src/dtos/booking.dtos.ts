import {
  IsUUID,
  IsArray,
  ArrayNotEmpty,
  IsNumber,
  Min,
  ValidateNested,
  Max,
  IsOptional,
  IsNotEmpty,
} from "class-validator";

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

export class GetBookingsQueryDto {
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  page!: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit!: number;

  @IsOptional()
  @IsUUID("4", { message: "Event ID must be a valid UUID" })
  eventId?: string;

  @IsOptional()
  @IsUUID("4", { message: "User ID must be a valid UUID" })
  userId?: string;
}

export class GetBookingByIdRequestDto {
  @IsNotEmpty({ message: "Booking ID is required" })
  @Type(() => String)
  @IsUUID("4", { message: "Booking ID must be a valid UUID" })
  id!: string;
}

export class BookingActionRequestDto {
  @IsNotEmpty({ message: "Booking ID is required" })
  @Type(() => String)
  @IsUUID("4", { message: "Booking ID must be a valid UUID" })
  id!: string;
}
