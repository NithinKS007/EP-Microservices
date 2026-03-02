import { createHash, randomBytes } from "crypto";

export class TokenService {
  hashAuthToken = (token: string): string => {
    return createHash("sha256").update(token).digest("hex");
  };

  generateAuthToken = (): string => {
    return randomBytes(32).toString("hex"); // 64 chars
  };
}
