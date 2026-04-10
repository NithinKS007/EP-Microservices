import {
  IsString,
  IsEnum,
  IsUUID,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  IsOptional,
  IsNotEmpty,
} from "class-validator";
import { Type } from "class-transformer";
import { SagaStatus } from "./../entity/saga.entity";
import { StepStatus } from "./../entity/saga.step.entity";

export class CreateSagaStepDto {
  @IsString()
  stepName!: string;

  @IsInt()
  @Min(1)
  stepOrder!: number;
}

export class CreateSagaDto {
  @IsString()
  sagaType!: string; // ex: BOOKING_SAGA

  @IsUUID()
  referenceId!: string; // bookingId

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSagaStepDto)
  steps!: CreateSagaStepDto[];
}

export class UpdateSagaStatusDto {
  @IsEnum(SagaStatus)
  status!: SagaStatus;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}

export class UpdateSagaStepDto {
  @IsEnum(StepStatus)
  status!: StepStatus;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}

export class RetrySagaStepDto {
  @IsInt()
  @Min(1)
  retryCount!: number;
}

export class CompensateSagaDto {
  @IsString()
  reason!: string;
}

export class FindSagaQueryDto {
  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @IsOptional()
  @IsString()
  sagaType?: string;

  @IsOptional()
  @IsEnum(SagaStatus)
  status?: SagaStatus;
}

export class FindSagaStatusQueryDto {

  @IsNotEmpty()
  @IsUUID()
  @Type(() => String)
  id!: string;
}