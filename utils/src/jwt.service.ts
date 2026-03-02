import jwt, { JwtPayload } from "jsonwebtoken";

export interface Env {
  JWT_ACCESS_TOKEN_SECRET: string;
  JWT_ACCESS_TOKEN_EXPIRATION: number;
  JWT_REFRESH_TOKEN_SECRET: string;
  JWT_REFRESH_TOKEN_EXPIRATION: number;
}

export interface IJwtPayload extends JwtPayload {
  id: string;
  email: string;
  role: "admin" | "user"
}
export class JwtService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiration: number;
  private readonly refreshExpiration: number;

  constructor({
    accessSecret,
    refreshSecret,
    accessExpiration,
    refreshExpiration,
  }: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiration: number;
    refreshExpiration: number;
  }) {
    if (!accessSecret || !refreshSecret) {
      throw new Error("JwtService requires secrets");
    }

    if (!accessExpiration || !refreshExpiration) {
      throw new Error("JwtService requires expiration config");
    }

    this.accessSecret = accessSecret;
    this.refreshSecret = refreshSecret;
    this.accessExpiration = accessExpiration;
    this.refreshExpiration = refreshExpiration;
  }

  async createAT(payload: IJwtPayload): Promise<string> {
    return new Promise((resolve, reject) => {
      jwt.sign(payload, this.accessSecret, { expiresIn: this.accessExpiration }, (err, token) => {
        if (err || !token) return reject(err);
        resolve(token);
      });
    });
  }

  async createRT(payload: IJwtPayload): Promise<string> {
    return new Promise((resolve, reject) => {
      jwt.sign(payload, this.refreshSecret, { expiresIn: this.refreshExpiration }, (err, token) => {
        if (err || !token) return reject(err);
        resolve(token);
      });
    });
  }

  async verifyAT(token: string): Promise<IJwtPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(token, this.accessSecret, (err, decoded) => {
        if (err) return reject(err);

        if (!decoded || typeof decoded === "string") {
          return reject(new Error("Invalid token payload"));
        }
        const payload = { id: decoded.id, role: decoded.role, email: decoded.email };
        resolve(payload);
      });
    });
  }

  async verifyRT(token: string): Promise<IJwtPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(token, this.refreshSecret, (err, decoded) => {
        if (err) return reject(err);

        if (!decoded || typeof decoded === "string") {
          return reject(new Error("Invalid token payload"));
        }
        const payload = { id: decoded.id, role: decoded.role, email: decoded.email };
        resolve(payload);
      });
    });
  }
}
