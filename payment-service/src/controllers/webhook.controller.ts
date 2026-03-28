import { Response } from "express";
import crypto from "crypto";
import { PaymentService } from "../services/payment.service";
import { envConfig } from "../config/env.config";
import { AuthReq, logger, StatusCodes } from "../../../utils/src";
import { ValidationError } from "../../../utils/src/error.handling.middleware";
import { WEBHOOK_EVENT_TYPE } from "../dtos/payment..dtos";
import { sendResponse } from "../../../utils/src";

export class WebhookController {
  private readonly paymentService: PaymentService;
  constructor({ paymentService }: { paymentService: PaymentService }) {
    this.paymentService = paymentService;
  }

  async handle(req: AuthReq, res: Response) {
    const signature = req.headers["x-razorpay-signature"];
    if (!signature || typeof signature !== "string") {
      throw new ValidationError("Invalid signature, Please try again later");
    }

    logger.info(`Webhook received PATH ${req.path} SIGNATURE ${signature}`);
    const payload = this.validateWebhookSecret(req, signature);

    logger.info(`Webhook signature verified`);
    const event = payload.event;

    logger.info(
      `Processing webhook event ${event} 
       razorpayPaymentId ${payload?.payload?.payment?.entity?.id} 
       razorpayOrderId ${payload?.payload?.payment?.entity?.order_id}`,
    );

    switch (event) {
      case WEBHOOK_EVENT_TYPE.PAYMENT_CAPTURED: {
        const result = await this.handleEvent(payload.payload, WEBHOOK_EVENT_TYPE.PAYMENT_CAPTURED);
        logger.info(`Payment captured flow completed ${result}`);
        sendResponse(res, StatusCodes.OK, result, "Success");
        break;
      }

      case WEBHOOK_EVENT_TYPE.PAYMENT_FAILED: {
        const result = await this.handleEvent(payload.payload, WEBHOOK_EVENT_TYPE.PAYMENT_FAILED);
        logger.info(`Payment failed flow completed ${result}`);
        sendResponse(res, StatusCodes.OK, result, "Success");
        break;
      }

      default:
        logger.warn(`Unhandled webhook event received { event }`);
        sendResponse(res, StatusCodes.OK, {}, "Ignored");
    }
  }

  private validateWebhookSecret(req: AuthReq, signature: string) {
    const secret = envConfig.RAZORPAY_WEBHOOK_SECRET;
    const rawBody = req.body;
    logger.debug(`Validating webhook signature SIGNATURE ${signature} RAW_BODY ${rawBody}`);

    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    if (signature !== expected) {
      logger.error(`Invalid signature ${signature} expected ${expected}`);
      throw new ValidationError("Invalid signature, Please try again later");
    }
    const payload = JSON.parse(rawBody.toString());
    logger.debug(`Signature validation successful`);
    return payload;
  }

  private async handleEvent<K extends "payment.captured" | "payment.failed">(
    payload: {
      payment: {
        entity: {
          id: string;
          amount: number;
          currency: string;
          status: string;
          order_id: string;
          method: string;
        };
      };
    },
    event: K,
  ) {
    switch (event) {
      case "payment.captured":
        return await this.paymentService.handlePaymentCaptured(payload.payment.entity);

      case "payment.failed":
        return await this.paymentService.handlePaymentFailed(payload.payment.entity);
    }
  }
}
