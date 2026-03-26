import { IsNotEmpty, IsString } from "class-validator";

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
