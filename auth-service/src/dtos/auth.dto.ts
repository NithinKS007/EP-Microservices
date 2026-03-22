import { IsEmail, IsNotEmpty, IsString, MinLength, Matches } from "class-validator";

export enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
}

export class SignupRequestDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail({}, { message: "Please provide a valid email address" })
  email!: string;

  // Example : SecureP@ssword123!

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      "Password is too weak. Must include uppercase, lowercase, number, and special character.",
  })
  password!: string;
}

export class SigninRequestDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      "Password is too weak. Must include uppercase, lowercase, number, and special character.",
  })
  password!: string;
}
