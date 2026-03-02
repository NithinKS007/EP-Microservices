import nodemailer, { Transporter } from "nodemailer";
import { ValidationError } from "./error.helper";
import { logger } from "./logger";

export class EmailService {
  private readonly emailUser: string;
  private readonly emailPass: string;
  private transporter: Transporter;
  constructor({ emailUser, emailPass }: { emailUser: string; emailPass: string }) {
    this.emailUser = emailUser;
    this.emailPass = emailPass;
    this.validateEnv();
    this.transporter = this.createTransporter();
  }

  private createTransporter(): Transporter {
    return nodemailer.createTransport({
      service: "gmail",
      port: 465,
      secure: true,
      auth: {
        user: this.emailUser,
        pass: this.emailPass,
      },
      tls: {
        rejectUnauthorized: true,
      },
    });
  }
  private validateEnv(): void {
    if (!this.emailUser || !this.emailPass) {
      throw new ValidationError("Email and password are required to send emails");
    }
  }

  async sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
    try {
      await this.transporter.sendMail({
        to: to,
        from: this.emailUser,
        subject: subject,
        text: text,
      });
      logger.info(`${to} ${subject} ${text}`);
    } catch (error) {
      console.log(`Error sending the email:${error}`);
      throw new ValidationError("Error sending the email");
    }
  }
}
