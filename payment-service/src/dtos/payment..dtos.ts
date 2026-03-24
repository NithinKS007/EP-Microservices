import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsPositive,
  IsOptional,
} from "class-validator";

enum PaymentStatus {
  INITATED = "INITATED",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

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
}
