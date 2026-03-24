import { IRefreshTokenRepository } from "interface/IRefresh.token.repository";
import { CronRunner } from "../../../utils/src";

export class TokenCleanupJob {
  private readonly refreshTokenRepository: IRefreshTokenRepository;
  private readonly cronRunner: CronRunner;

  constructor({
    refreshTokenRepository,
    cronRunner,
  }: {
    refreshTokenRepository: IRefreshTokenRepository;
    cronRunner: CronRunner;
  }) {
    this.refreshTokenRepository = refreshTokenRepository;
    this.cronRunner = cronRunner;
  }

  start() {
    this.cronRunner.schedule("Refresh Token Cleanup", "0 * * * *", async () => {
      await this.refreshTokenRepository.deleteExpiredTokens();
    });
  }
}
