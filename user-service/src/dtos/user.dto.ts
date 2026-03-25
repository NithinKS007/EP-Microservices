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
