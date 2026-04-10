import { UserEntity } from "../entity/user.entity";
import {
  comparePassword,
  hashPassword,
  JwtService,
  logger,
  TokenService,
} from "../../../utils/src";
import { UserServiceGrpcClient } from "../grpc/user.client";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../utils/src/error.handling.middleware";
import { IRefreshTokenRepository } from "./../interface/IRefresh.token.repository";
import { envConfig } from "./../config/env.config";
import { EmailAvailabilityResult, EmailAvailabilityService } from "./email.availability.service";

export class AuthService {
  private readonly userServiceGrpcClient: UserServiceGrpcClient;
  private readonly jwtService: JwtService;
  private readonly tokenService: TokenService;
  private readonly refreshTokenRepository: IRefreshTokenRepository;
  private readonly emailAvailabilityService: EmailAvailabilityService;
  constructor({
    userServiceGrpcClient,
    jwtService,
    tokenService,
    refreshTokenRepository,
    emailAvailabilityService,
  }: {
    userServiceGrpcClient: UserServiceGrpcClient;
    jwtService: JwtService;
    tokenService: TokenService;
    refreshTokenRepository: IRefreshTokenRepository;
    emailAvailabilityService: EmailAvailabilityService;
  }) {
    this.userServiceGrpcClient = userServiceGrpcClient;
    this.jwtService = jwtService;
    this.tokenService = tokenService;
    this.refreshTokenRepository = refreshTokenRepository;
    this.emailAvailabilityService = emailAvailabilityService;
  }

  /**
   * Public availability-check entry used by the auth route.
   *
   * Why this method exists:
   * - the frontend can ask for email availability before signup
   * - auth-service keeps orchestration in one place
   * - the real cache/Bloom/database sequence stays delegated to
   *   EmailAvailabilityService
   */
  async checkEmailAvailability(email: string): Promise<EmailAvailabilityResult> {
    if (!email) {
      throw new ValidationError("Email is required");
    }

    return await this.emailAvailabilityService.checkEmailAvailability(email);
  }

  /**
   * Signup write flow.
   *
   * What happens here:
   * 1. validate the input
   * 2. reject invalid ADMIN self-signup attempts
   * 3. call the email-availability read flow
   * 4. if available, create the user through user-service
   * 5. after the write succeeds, warm Redis exact cache and Bloom bits
   *
   * Why the cache/Bloom update happens after the DB write:
   * if Redis/Bloom were updated first and the DB insert failed, the system could
   * falsely mark an email as already taken.
   */
  async signup(data: {
    name: string;
    email: string;
    password: string;
    role: "ADMIN" | "USER";
  }): Promise<void> {
    const { email, password, name, role } = data;
    if (!email || !password || !name || !role)
      throw new Error("Email,password and name are required");

    if (role === "ADMIN") {
      throw new ValidationError("Invalid role, Please try again later");
    }

    const availability = await this.emailAvailabilityService.checkEmailAvailability(email);
    if (!availability.available) throw new ConflictError("Email already exists");

    await this.userServiceGrpcClient.createUser({
      ...data,
      password: await hashPassword(password),
    });
    await this.emailAvailabilityService.rememberExistingEmail(email);
  }

  /**
   * Signs a user in, issues tokens, and stores a refresh token record.
   * Used in: Auth signin flow
   * Triggered via: REST
   */
  async signin(data: {
    email: string;
    password: string;
    userAgent: string;
    ip: string;
  }): Promise<Omit<UserEntity, "password"> & { accessToken: string; refreshToken: string }> {
    const { email, password, userAgent, ip } = data;
    if (!email || !password || !userAgent || !ip)
      throw new Error("Email,password,userAgent and ip are required");

    const response = await this.userServiceGrpcClient.findUserByEmail({ email });

    if (!response.user) throw new NotFoundError("User not found,Please try again later");

    const isPasswordValid = await comparePassword(data.password, response.user.password);
    if (!isPasswordValid) throw new ValidationError("Password is incorrect");

    const safeUser = {
      id: response.user.id,
      name: response.user.name,
      email: response.user.email,
      role: response.user.role,
      createdAt: response.user.createdAt,
      updatedAt: response.user.updatedAt,
    };

    const accessToken = await this.jwtService.createAT({
      id: response.user.id,
      email: response.user.email,
      role: response.user.role,
    });
    const refreshToken = await this.jwtService.createRT({
      id: response.user.id,
      email: response.user.email,
      role: response.user.role,
    });

    const hashRefreshToken = this.tokenService.hashAuthToken(refreshToken);

    await this.refreshTokenRepository.create({
      expiresAt: new Date(Date.now() + envConfig.RT_TTL),
      tokenHash: hashRefreshToken,
      userId: response.user.id,
      revoked: false,
      ipAddress: ip,
      userAgent: userAgent,
    });

    await this.refreshTokenRepository.deleteOldTokens(response.user.id, 5);

    return {
      ...safeUser,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Rotates refresh tokens after validating device, token state, and expiry.
   * Used in: Auth refresh-token flow
   * Triggered via: REST
   */
  async refreshToken(data: {
    refreshToken: string;
    userAgent: string;
    ip: string;
  }): Promise<{ accessToken: string; refreshToken: string }> {
    const { refreshToken: incomingToken, userAgent: incomingUserAgent, ip: incomingIp } = data;
    if (!incomingToken)
      throw new ValidationError("Refresh token is required, Please try again later");

    const payload = await this.jwtService.verifyRT(incomingToken);

    const hashed = this.tokenService.hashAuthToken(incomingToken);
    const token = await this.refreshTokenRepository.findByTokenHash(hashed);
    if (!token) throw new ValidationError("Refresh token is invalid, Please try again later");

    if (token.userAgent !== incomingUserAgent || token.ipAddress !== incomingIp) {
      logger.warn(`Suspicious device detected for user ${token.userId}`);
      await this.refreshTokenRepository.revokeAllByUserId(token.userId);
      throw new ValidationError("Suspicious activity detected");
    }

    if (token.revoked) {
      await this.refreshTokenRepository.revokeAllByUserId(token.userId);
      throw new ValidationError("Refresh token is revoked, Please try again later");
    }

    if (token.expiresAt < new Date())
      throw new ValidationError("Refresh token is expired, Please try again later");

    const accessToken = await this.jwtService.createAT(payload);
    const newRefreshToken = await this.jwtService.createRT(payload);

    await this.refreshTokenRepository.update({ id: token.id }, { revoked: true });

    const hashNewRefreshToken = this.tokenService.hashAuthToken(newRefreshToken);
    await this.refreshTokenRepository.create({
      expiresAt: new Date(Date.now() + envConfig.RT_TTL),
      tokenHash: hashNewRefreshToken,
      userId: payload.id,
      revoked: false,
      ipAddress: incomingIp,
      userAgent: incomingUserAgent,
    });

    await this.refreshTokenRepository.deleteOldTokens(payload.id, 5);
    logger.info(`Refresh token rotated successfully for user ${payload.id}`);

    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Revokes refresh tokens for the current user session.
   * Used in: Auth signout flow
   * Triggered via: REST
   */
  async signout(data: { refreshToken: string }): Promise<void> {
    const { refreshToken } = data;

    if (!refreshToken)
      throw new ValidationError("Refresh token is required, Please try again later");

    const payload = await this.jwtService.verifyRT(refreshToken);

    const hashed = this.tokenService.hashAuthToken(refreshToken);
    const token = await this.refreshTokenRepository.findByTokenHash(hashed);

    if (!token) return;

    await this.refreshTokenRepository.revokeAllByUserId(payload.id);
  }
}
