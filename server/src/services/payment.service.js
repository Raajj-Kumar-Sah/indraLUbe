import crypto from "node:crypto";
import mongoose from "mongoose";
import Payment from "../models/payment.model.js";
import WebhookEvent from "../models/webhookEvent.model.js";
import Order from "../models/order.model.js";
import { getRazorpay } from "./razorpay.js";
import { createInvoiceForPaidOrder } from "./invoice.service.js";
import { recordAudit } from "./audit.js";
import { notifyUser } from "./notification.service.js";

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export async function createRazorpayOrder(req) {
  const order = await Order.findOne({ _id: req.params.orderId, distributor: req.user.sub });
  if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
  if (order.paymentStatus === "PAID") throw Object.assign(new Error("This order is already paid"), { status: 409 });
  if (order.paymentStatus === "REFUNDED") throw Object.assign(new Error("This order has been refunded"), { status: 409 });
  if (order.orderStatus === "CANCELLED") throw Object.assign(new Error("Cancelled orders cannot be paid"), { status: 409 });
  const existing = await Payment.findOne({ order: order._id, status: "CREATED" }).sort({ createdAt: -1 });
  if (existing && existing.providerOrderId) {
    return { paymentId: existing._id, razorpayOrderId: existing.providerOrderId, amount: existing.amountPaise, currency: existing.currency, keyId: process.env.RAZORPAY_KEY_ID, orderNumber: order.orderNumber };
  }
  const amountPaise = Math.round(order.totalAmount * 100);
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) throw Object.assign(new Error("Order amount is invalid for online payment"), { status: 400 });
  const razorpay = getRazorpay();
  const rpOrder = await razorpay.orders.create({
    amount: amountPaise, currency: "INR", receipt: order.orderNumber,
    notes: { internalOrderId: String(order._id), orderNumber: order.orderNumber, distributorId: String(req.user.sub) }
  });
  const payment = await Payment.create({
    order: order._id, distributor: req.user.sub, provider: "RAZORPAY",
    providerOrderId: rpOrder.id, amount: order.totalAmount, amountPaise,
    currency: "INR", status: "CREATED"
  });
  order.paymentMethod = "RAZORPAY";
  await order.save();
  await recordAudit(req, "RAZORPAY_ORDER_CREATED", "Payment", payment._id, { orderNumber: order.orderNumber, razorpayOrderId: rpOrder.id });
  return { paymentId: payment._id, razorpayOrderId: rpOrder.id, amount: amountPaise, currency: "INR", keyId: process.env.RAZORPAY_KEY_ID, orderNumber: order.orderNumber };
}

export async function verifyCheckout(req) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) throw Object.assign(new Error("Missing Razorpay verification fields"), { status: 400 });
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
  if (!safeEqual(expected, razorpay_signature)) throw Object.assign(new Error("Payment signature verification failed"), { status: 400 });
  const payment = await Payment.findOne({ providerOrderId: razorpay_order_id, distributor: req.user.sub });
  if (!payment) throw Object.assign(new Error("Payment record not found"), { status: 404 });
  if (payment.providerPaymentId && payment.providerPaymentId !== razorpay_payment_id) throw Object.assign(new Error("Payment ID mismatch"), { status: 409 });
  const rpPayment = await getRazorpay().payments.fetch(razorpay_payment_id);
  if (rpPayment.order_id !== razorpay_order_id || rpPayment.amount !== payment.amountPaise || rpPayment.currency !== "INR") {
    throw Object.assign(new Error("Payment details do not match this order"), { status: 409 });
  }
  if (rpPayment.status !== "captured" && rpPayment.status !== "authorized") {
    throw Object.assign(new Error("Payment is not captured yet. The webhook will update the order once confirmed."), { status: 409 });
  }
  if (rpPayment.status === "authorized") {
    payment.status = "AUTHORIZED"; payment.providerPaymentId = razorpay_payment_id; await payment.save();
    return { status: "AUTHORIZED", message: "Payment authorized; awaiting capture confirmation" };
  }
  return applyCapturedPayment(payment, razorpay_payment_id);
}

async function applyCapturedPayment(payment, paymentId) {
  const session = await mongoose.startSession(); let order;
  try {
    await session.withTransaction(async () => {
      const current = await Payment.findById(payment._id).session(session);
      if (!current) throw Object.assign(new Error("Payment record not found"), { status: 404 });
      if (current.status === "CAPTURED") {
        order = await Order.findById(current.order).session(session); return;
      }
      current.status = "CAPTURED"; current.providerPaymentId = paymentId; current.capturedAt = new Date(); await current.save({ session });
      order = await Order.findById(current.order).session(session);
      if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
      if (order.paymentStatus !== "PAID") { order.paymentStatus = "PAID"; order.paymentMethod = "RAZORPAY"; await order.save({ session }); }
    });
  } finally { await session.endSession(); }
  await createInvoiceForPaidOrder(order, paymentId);
  await notifyUser({ recipient: order.distributor, type: "PAYMENT_SUCCESS", title: "Payment confirmed", message: `Payment for order ${order.orderNumber} has been captured successfully.`, link: "/dashboard/distributor/orders", entityType: "Order", entityId: order.id });
  return { status: "CAPTURED", message: "Payment confirmed", invoiceAvailable: true };
}

export async function handleRazorpayWebhook(req) {
  const signature = req.headers["x-razorpay-signature"];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw Object.assign(new Error("Webhook secret is not configured"), { status: 503 });
  const expected = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
  if (!safeEqual(expected, signature)) throw Object.assign(new Error("Invalid webhook signature"), { status: 400 });
  const event = JSON.parse(req.body.toString("utf8"));
  const eventId = req.headers["x-razorpay-event-id"] || crypto.createHash("sha256").update(req.body).digest("hex");
  try { await WebhookEvent.create({ eventId, eventType: event.event }); }
  catch (e) { if (e.code === 11000) return { received: true, duplicate: true }; throw e; }
  const entity = event.payload?.payment?.entity;
  if (entity?.order_id) {
    const payment = await Payment.findOne({ providerOrderId: entity.order_id });
    if (payment) {
      if (event.event === "payment.captured" || event.event === "order.paid") {
        await applyCapturedPayment(payment, entity.id);
      } else if (event.event === "payment.failed" && payment.status !== "CAPTURED") {
        payment.status = "FAILED"; payment.providerPaymentId = entity.id; payment.failureReason = entity.error_description || entity.error_reason || "Payment failed"; await payment.save();
        await Order.updateOne({ _id: payment.order, paymentStatus: { $ne: "PAID" } }, { $set: { paymentStatus: "FAILED" } });
      }
    }
  }
  if (event.event === "refund.processed") {
    const refund = event.payload?.refund?.entity;
    if (refund?.payment_id) {
      const payment = await Payment.findOne({ providerPaymentId: refund.payment_id });
      if (payment) {
        payment.status = "REFUNDED"; await payment.save();
        await Order.updateOne({ _id: payment.order }, { $set: { paymentStatus: "REFUNDED" } });
      }
    }
  }
  return { received: true };
}

export async function listMyPayments(req) {
  return Payment.find({ distributor: req.user.sub }).select("-metadata").populate("order", "orderNumber totalAmount orderStatus").sort({ createdAt: -1 }).limit(100).lean();
}

export async function listAdminPayments(query = {}) {
  const filter = {}; if (query.status) filter.status = query.status;
  return Payment.find(filter).select("-metadata").populate("order", "orderNumber totalAmount paymentStatus").populate("distributor", "name email").sort({ createdAt: -1 }).limit(200).lean();
}
