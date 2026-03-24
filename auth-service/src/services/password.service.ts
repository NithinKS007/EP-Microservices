import { UserServiceGrpcClient } from "./../grpc/user.client";
import { NotFoundError, ValidationError } from "../../../utils/src/error.handling.middleware";
import { comparePassword, EmailService, hashPassword, TokenService } from "../../../utils/src";
import { envConfig } from "./../config/env.config";
import { IPasswordResetTokenRepository } from "./../interface/IPassword.token.repository";

export class PasswordService {
  private readonly userServiceGrpcClient: UserServiceGrpcClient;
  private readonly tokenService: TokenService;
  private readonly emailService: EmailService;
  private readonly passwordResetTokenRepository: IPasswordResetTokenRepository;

  constructor({
    userServiceGrpcClient,
    tokenService,
    emailService,
    passwordResetTokenRepository,
  }: {
    userServiceGrpcClient: UserServiceGrpcClient;
    tokenService: TokenService;
    emailService: EmailService;
    passwordResetTokenRepository: IPasswordResetTokenRepository;
  }) {
    this.userServiceGrpcClient = userServiceGrpcClient;
    this.tokenService = tokenService;
    this.emailService = emailService;
    this.passwordResetTokenRepository = passwordResetTokenRepository;
  }

  async sendResetPassLink(data: { email: string }): Promise<void> {
    const { email } = data;
    if (!email) throw new ValidationError("Email is required");

    const userData = await this.userServiceGrpcClient.findUserByEmail({ email });
    if (!userData.user) {
      throw new NotFoundError("User not found,Please try again later");
    }

    const token = this.tokenService.generateAuthToken();
    const hashedToken = this.tokenService.hashAuthToken(token);

    const productionUrl = envConfig.CLIENT_URL;
    const resetURL = `${productionUrl}/auth/reset-password/${token}`;
    const subject = "Password Reset";
    const text =
      `You are receiving this because you (or someone else) have requested the reset of the 
       password for your account.\n\n` +
      `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
      `${resetURL}\n\n` +
      `If you did not request this, please ignore this email and your password will remain unchanged.`;

    await Promise.all([
      this.passwordResetTokenRepository.create({
        email,
        tokenHash: hashedToken,
        expiresAt: new Date(Date.now() + envConfig.PRT_TTL),
        used: false,
      }),
      this.emailService.sendEmail({ to: email, subject, text }),
    ]);
  }

  async changePassUsingToken(data: { token: string; password: string }): Promise<void> {
    const { token, password } = data;

    if (!token || !password) throw new ValidationError("Token and password are required");

    const hashedToken = this.tokenService.hashAuthToken(token);
    const tokenData = await this.passwordResetTokenRepository.findOne({ tokenHash: hashedToken });
    if (!tokenData) throw new NotFoundError("Link is invalid, Please try again later");

    if (tokenData.expiresAt < new Date())
      throw new ValidationError("Token is expired, Please try again later");

    if (tokenData.used) throw new ValidationError("Token is already used, Please try again later");

    const hashedPassword = await hashPassword(password);
    const updated = await this.passwordResetTokenRepository.update(
      { id: tokenData.id, used: false },
      { used: true },
    );

    if (!updated) {
      throw new ValidationError("Token already used, Please try again later");
    }

    const userData = await this.userServiceGrpcClient.findUserByEmail({
      email: tokenData.email,
    });

    if (!userData.user) {
      throw new NotFoundError("User not found, Please try again later");
    }

    await this.userServiceGrpcClient.updateUserPassword({
      userId: userData.user.id,
      password: hashedPassword,
    });
  }

  async changePass(data: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const { userId, currentPassword, newPassword } = data;

    if (!userId || !currentPassword || !newPassword)
      throw new ValidationError("User id and password are required");

    if (currentPassword === newPassword) {
      throw new ValidationError("New password must be different from current password");
    }
    const userData = await this.userServiceGrpcClient.findUserById({userId, });
    if (!userData.user) throw new NotFoundError("User not found, Please try again later");

    const pass = await comparePassword(currentPassword, userData.user.password);
    if (!pass) throw new ValidationError("Current password is incorrect");

    const hashedPassword = await hashPassword(newPassword);
    await this.userServiceGrpcClient.updateUserPassword({
      userId: userData.user.id,
      password: hashedPassword,
    });
  }
}
