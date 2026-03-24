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

export class AuthService {
  private readonly userServiceGrpcClient: UserServiceGrpcClient;
  private readonly jwtService: JwtService;
  private readonly tokenService: TokenService;
  private readonly refreshTokenRepository: IRefreshTokenRepository;
  constructor({
    userServiceGrpcClient,
    jwtService,
    tokenService,
    refreshTokenRepository,
  }: {
    userServiceGrpcClient: UserServiceGrpcClient;
    jwtService: JwtService;
    tokenService: TokenService;
    refreshTokenRepository: IRefreshTokenRepository;
  }) {
    this.userServiceGrpcClient = userServiceGrpcClient;
    this.jwtService = jwtService;
    this.tokenService = tokenService;
    this.refreshTokenRepository = refreshTokenRepository;
  }

  async signup(data: {
    name: string;
    email: string;
    password: string;
    role?: "ADMIN" | "USER" | undefined;
  }): Promise<void> {
    const { email, password, name, role } = data;
    if (!email || !password || !name) throw new Error("Email,password and name are required");

    if (role === "ADMIN") {
      throw new ValidationError("Invalid role, Please try again later");
    }

    const userData = await this.userServiceGrpcClient.findUserByEmail({ email });
    if (userData) throw new ConflictError("Email already exists");

    await this.userServiceGrpcClient.createUser({
      ...data,
      password: await hashPassword(password),
    });
  }

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

    const { password: userPassword, ...safeUser } = response.user;

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
