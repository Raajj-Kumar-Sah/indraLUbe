import * as service from "../services/payment.service.js";

export async function createOrder(req, res, next) {
  try {
    res.status(201).json({ success: true, data: await service.createRazorpayOrder(req) });
  } catch (e) {
    next(e);
  }
}

export async function verify(req, res, next) {
  try {
    res.json({ success: true, data: await service.verifyCheckout(req) });
  } catch (e) {
    next(e);
  }
}

export async function webhook(req, res) {
  try {
    const result = await service.handleRazorpayWebhook(req);
    res.json({ success: true, ...result });
  } catch (e) {
    console.error("Razorpay webhook error", e.message);
    res.status(e.status || 500).json({ success: false, message: e.message });
  }
}

export async function mine(req, res, next) {
  try {
    res.json({ success: true, data: await service.listMyPayments(req) });
  } catch (e) {
    next(e);
  }
}

export async function adminList(req, res, next) {
  try {
    res.json({ success: true, data: await service.listAdminPayments(req.query) });
  } catch (e) {
    next(e);
  }
}
