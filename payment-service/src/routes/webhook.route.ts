import { Router } from "express";
import { container } from "../container";
import { WebhookController } from "../controllers/webhook.controller";
import { asyncHandler } from "../../../utils/src";
import express from "express";

const router = Router();

const webhookController = container.resolve<WebhookController>("webhookController");

router.post(
  "/razorpay",
  express.raw({ type: "application/json" }),
  asyncHandler(webhookController.handle.bind(webhookController)),
);

export default router;
