import { IsEmail, IsNotEmpty, IsString, MinLength, Matches } from "class-validator";

export class ResetPasswordRequestDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

export class ValidateResetPasswordTokenRequestDto {
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      "Password is too weak. Must include uppercase, lowercase, number, and special character.",
  })
  password!: string;
}

export class ChangePasswordRequestDto {
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      "Password is too weak. Must include uppercase, lowercase, number, and special character.",
  })
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      "Password is too weak. Must include uppercase, lowercase, number, and special character.",
  })
  newPassword!: string;
}
