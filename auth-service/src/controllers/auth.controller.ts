import { Request, Response } from "express";
import { AuthReq, JwtService, sendResponse, StatusCodes, WithMetaData } from "../../../utils/src";
import { validateDto } from "../../../utils/src";
import { AuthService } from "./../services/auth.service";
import {
  RefreshTokenRequestDto,
  SigninRequestDto,
  SignOutRequestDto,
  SignupRequestDto,
} from "../dtos/auth.dto";

export class AuthController {
  private readonly authService: AuthService;
  private readonly jwtService: JwtService;

  constructor({ authService, jwtService }: { authService: AuthService; jwtService: JwtService }) {
    this.authService = authService;
    this.jwtService = jwtService;
  }

  async signup(req: Request, res: Response): Promise<void> {
    const data = await validateDto(SignupRequestDto, req.body);
    await this.authService.signup(data);
    sendResponse(res, StatusCodes.Created, null, "User created successfully");
  }

  async signin(req: WithMetaData, res: Response): Promise<void> {
    const data = await validateDto(SigninRequestDto, {
      ...req.body,
      userAgent: req.meta?.userAgent,
      ip: req.meta?.ip,
    });
    const result = await this.authService.signin(data);
    const { name, accessToken, refreshToken } = result;
    this.jwtService.setRefreshTokenCookie(res, refreshToken, "DEV");
    sendResponse(res, StatusCodes.OK, { name, accessToken }, "Login successfully");
  }

  async refreshToken(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(RefreshTokenRequestDto, {
      ...req.cookies,
      userAgent: req.meta?.userAgent,
      ip: req.meta?.ip,
    });
    const result = await this.authService.refreshToken(data);
    const { accessToken, refreshToken } = result;
    this.jwtService.setRefreshTokenCookie(res, refreshToken, "DEV");
    sendResponse(res, StatusCodes.OK, { accessToken }, "Refresh token successfully");
  }

  async signout(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(SignOutRequestDto, { ...req.cookies });
    await this.authService.signout(data);
    this.jwtService.clearRefreshTokenCookie(res, "DEV");
    sendResponse(res, StatusCodes.OK, null, "Logout successfully");
  }
}
