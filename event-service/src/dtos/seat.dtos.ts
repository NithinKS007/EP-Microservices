import { IsString, IsNumber, IsOptional, IsEnum, IsArray, ValidateNested, IsDateString } from "class-validator";
import { Type } from "class-transformer";

export enum SeatStatus {
  AVAILABLE = "AVAILABLE",
  LOCKED = "LOCKED",
  SOLD = "SOLD",
}

export enum SeatTier {
  VIP = "VIP",
  REGULAR = "REGULAR",
  ECONOMY = "ECONOMY",
}

export class CreateSeatDto {
  @IsString()
  seatNumber!: string;

  @IsEnum(SeatTier)
  seatTier!: SeatTier;

  @IsNumber()
  price!: number;
}

export class CreateSeatsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSeatDto)
  seats!: CreateSeatDto[];

  @IsString()
  eventId!: string;
}

export class GetSeatsQueryDto {
  @IsOptional()
  @IsEnum(SeatStatus)
  seatStatus?: SeatStatus;

  @IsOptional()
  @IsEnum(SeatTier)
  seatTier?: SeatTier;

  @IsString()
  eventId!: string;

  @Type(() => Number)
  @IsNumber()
  page!: number;

  @Type(() => Number)
  @IsNumber()
  limit!: number;
}

// DTO for locking a seat
export class LockSeatDto {
  @IsString()
  userId!: string;

  @IsDateString()
  lockExpiresAt!: string;
}
