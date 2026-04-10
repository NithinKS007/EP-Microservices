import { IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class FindUserByIdRequestDto {
  @IsString()
  @IsNotEmpty()
  id!: string;
}

export class UpdateUserRequestDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  name!: string;
}

export class UpdateSystemRoleRequestDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  role!: "USER" | "ADMIN";

  @IsString()
  @IsNotEmpty()
  systemCode!: string;
}

export class FindPaginatedUsersRequestDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit!: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  page!: number;
}
