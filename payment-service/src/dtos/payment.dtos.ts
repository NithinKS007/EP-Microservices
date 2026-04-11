import { IsUUID, IsString, IsNotEmpty, IsNumber, IsPositive, IsOptional } from "class-validator";

export class CreatePaymentDto {
  @IsUUID()
  bookingId!: string;

  @IsUUID()
  userId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsString()
  @IsNotEmpty()
  provider!: string;

  @IsOptional()
  @IsString()
  providerRef?: string;
}

export enum WEBHOOK_EVENT_TYPE {
  PAYMENT_CAPTURED = "payment.captured",
  PAYMENT_FAILED = "payment.failed",
  PAYMENT_ORPHANED = "payment.orphaned",
  PAYMENT_REFUNDED = "payment.refunded",
}

export class GetPaymentByIdRequestDto {
  @IsUUID()
  id!: string;
}

export class GetPaymentByBookingIdRequestDto {
  @IsUUID()
  id!: string;
}

export class InitiatePaymentRequestDto {
  @IsUUID()
  id!: string;
}


