import { PasswordService } from "./../services/password.service";
import { AuthReq, sendResponse, StatusCodes, validateDto } from "../../../utils/src";
import { Request, Response } from "express";
import {
  ChangePasswordRequestDto,
  ResetPasswordRequestDto,
  ValidateResetPasswordTokenRequestDto,
} from "./../dtos/password.dto";

export class PasswordController {
  private readonly passwordService: PasswordService;
  constructor({ passwordService }: { passwordService: PasswordService }) {
    this.passwordService = passwordService;
  }

  async sendResetPassLink(req: Request, res: Response): Promise<void> {
    const data = await validateDto(ResetPasswordRequestDto, req.body);
    await this.passwordService.sendResetPassLink(data);
    sendResponse(res, StatusCodes.OK, null, "Reset password link sent successfully");
  }

  async changePassUsingToken(req: Request, res: Response): Promise<void> {
    const data = await validateDto(ValidateResetPasswordTokenRequestDto, {
      ...req.body,
      token: req.params.token,
    });
    await this.passwordService.changePassUsingToken(data);
    sendResponse(res, StatusCodes.OK, null, "Password changed successfully");
  }

  async changePass(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(ChangePasswordRequestDto, req.body);
    await this.passwordService.changePass({ ...data, userId: req?.user?.id! });
    sendResponse(res, StatusCodes.OK, null, "Password changed successfully");
  }
}
