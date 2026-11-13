import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import * as controller from "../controllers/payment.controller.js";

export const paymentWebhookRoutes = Router();
paymentWebhookRoutes.post(
  "/razorpay",
  (req, res, next) => {
    if (!Buffer.isBuffer(req.body)) return res.status(400).json({ success: false, message: "Raw webhook body required" });
    next();
  },
  controller.webhook
);

export const distributorPaymentRoutes = Router();
distributorPaymentRoutes.use(authenticate, authorize("DISTRIBUTOR"));
distributorPaymentRoutes.post("/orders/:orderId/razorpay-order", controller.createOrder);
distributorPaymentRoutes.post("/verify", controller.verify);
distributorPaymentRoutes.get("/", controller.mine);

export const adminPaymentRoutes = Router();
adminPaymentRoutes.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));
adminPaymentRoutes.get("/", controller.adminList);
