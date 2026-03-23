import { IsNotEmpty, IsString } from "class-validator";

export class FindUserByIdRequestDto {
  @IsString()
  @IsNotEmpty()
  id!: string;
}
