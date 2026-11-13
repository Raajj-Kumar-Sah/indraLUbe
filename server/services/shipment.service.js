import crypto from "node:crypto";
import Shipment from "../models/shipment.model.js";
import Order from "../models/order.model.js";
import { sendTransactionalEmail } from "./email.js";
import { notifyUser } from "./notification.service.js";
import { recordAudit } from "./audit.js";
import { shipmentTransitions, canTransitionShipment } from "./shipment.workflow.js";

const hash = v => crypto.createHash("sha256").update(v).digest("hex");
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function safe(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function createOrUpdateShipment(req) {
  const { carrier, trackingNumber, trackingUrl = "", estimatedDelivery = null } = req.body || {};
  if (typeof carrier !== "string" || !carrier.trim() || carrier.length > 100 || typeof trackingNumber !== "string" || !trackingNumber.trim() || trackingNumber.length > 120 || typeof trackingUrl !== "string" || trackingUrl.length > 500) {
    throw fail("Carrier and tracking number are required; shipment details are invalid");
  }
  if (trackingUrl && !/^https:\/\/\S+$/i.test(trackingUrl)) throw fail("Tracking URL must use HTTPS");
  const date = estimatedDelivery ? new Date(estimatedDelivery) : null;
  if (estimatedDelivery && (!date || Number.isNaN(date.getTime()))) throw fail("Estimated delivery date is invalid");
  const order = await Order.findById(req.params.orderId);
  if (!order) throw fail("Order not found", 404);
  if (!["PACKED", "DISPATCHED", "OUT_FOR_DELIVERY"].includes(order.orderStatus)) throw fail("Shipment can be assigned only after an order is packed", 409);
  let shipment = await Shipment.findOne({ order: order._id });
  if (shipment && ["DELIVERED", "RETURNED"].includes(shipment.status)) throw fail("Closed shipment cannot be edited", 409);
  if (!shipment) {
    shipment = await Shipment.create({
      order: order._id, distributor: order.distributor, orderNumber: order.orderNumber,
      carrier: carrier.trim(), trackingNumber: trackingNumber.trim(), trackingUrl: trackingUrl.trim(),
      estimatedDelivery: date, status: "CREATED",
      events: [{ status: "CREATED", note: "Shipment registered", changedBy: req.user.sub }]
    });
  } else {
    shipment.carrier = carrier.trim();
    shipment.trackingNumber = trackingNumber.trim();
    shipment.trackingUrl = trackingUrl.trim();
    shipment.estimatedDelivery = date;
    await shipment.save();
  }
  order.shipment = { ...order.shipment.toObject(), carrier: shipment.carrier, trackingNumber: shipment.trackingNumber, trackingUrl: shipment.trackingUrl, estimatedDelivery: date };
  await order.save();
  await recordAudit(req, "SHIPMENT_REGISTERED", "Shipment", shipment._id, { orderNumber: order.orderNumber, carrier: shipment.carrier });
  return shipment;
}

export async function listShipments(query = {}) {
  const filter = {};
  if (query.status && Object.hasOwn(shipmentTransitions, query.status)) filter.status = query.status;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
  const [items, total] = await Promise.all([
    Shipment.find(filter).populate("distributor", "name email").sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Shipment.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}

export async function listMyShipments(userId) {
  return Shipment.find({ distributor: userId }).sort({ updatedAt: -1 }).lean();
}

export async function getMyShipment(userId, orderId) {
  const shipment = await Shipment.findOne({ order: orderId, distributor: userId }).lean();
  if (!shipment) throw fail("Shipment not found", 404);
  return shipment;
}

export async function updateShipmentStatus(req) {
  const { status, note = "", reason = "" } = req.body || {};
  if (!Object.hasOwn(shipmentTransitions, status) || typeof note !== "string" || note.length > 300 || typeof reason !== "string" || reason.length > 300) {
    throw fail("Invalid shipment status or note");
  }
  const shipment = await Shipment.findOne({ order: req.params.orderId });
  if (!shipment) throw fail("Shipment not found", 404);
  if (!canTransitionShipment(shipment.status, status)) throw fail(`Cannot move shipment from ${shipment.status} to ${status}`, 409);
  if (status === "DELIVERY_FAILED" && !reason.trim()) throw fail("A delivery failure reason is required");
  if (status === "RETURN_INITIATED" && !reason.trim()) throw fail("A return reason is required");
  const order = await Order.findById(shipment.order);
  if (!order) throw fail("Associated order not found", 404);
  shipment.status = status;
  if (status === "DELIVERY_FAILED") shipment.failureReason = reason.trim();
  if (status === "RETURN_INITIATED") shipment.returnReason = reason.trim();
  if (status === "OUT_FOR_DELIVERY") {
    const otp = String(crypto.randomInt(100000, 1000000));
    shipment.deliveryOtpHash = hash(otp);
    shipment.deliveryOtpExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    shipment.otpAttempts = 0;
    shipment.otpLockedUntil = null;
    try {
      await sendTransactionalEmail({
        to: order.distributorSnapshot?.email,
        subject: `Delivery OTP for ${order.orderNumber}`,
        htmlText: `<p>Your order <strong>${safe(order.orderNumber)}</strong> is out for delivery.</p><p>Your delivery confirmation OTP is <strong style="font-size:24px">${otp}</strong>.</p><p>Share this OTP with the delivery agent only when the goods have been received. It expires in 24 hours.</p>`,
        textContent: `Your delivery OTP for ${order.orderNumber} is ${otp}. Share only after receiving the goods. Expires in 24 hours.`
      });
    } catch {
      throw fail("Could not send delivery OTP. Check Brevo configuration and retry.", 503);
    }
  }
  shipment.events.push({ status, note: note.trim() || (reason.trim() || status.replaceAll("_", " ")), changedBy: req.user.sub });
  if (status === "DELIVERED") shipment.deliveredAt = new Date();
  await shipment.save();
  if (status === "DELIVERED") {
    order.orderStatus = "DELIVERED";
    order.shipment.deliveredAt = shipment.deliveredAt;
    order.statusHistory.push({ status: "DELIVERED", note: "Delivery confirmed with customer OTP", changedBy: req.user.sub });
  } else if (status === "OUT_FOR_DELIVERY") {
    order.orderStatus = "OUT_FOR_DELIVERY";
    order.statusHistory.push({ status: "OUT_FOR_DELIVERY", note: "Shipment is out for delivery", changedBy: req.user.sub });
  } else if (status === "IN_TRANSIT" || status === "PICKED_UP") {
    if (order.orderStatus === "PACKED") order.orderStatus = "DISPATCHED";
    order.statusHistory.push({ status: order.orderStatus, note: `Shipment ${status.toLowerCase().replaceAll("_", " ")}`, changedBy: req.user.sub });
  } else if (status === "DELIVERY_FAILED") {
    order.statusHistory.push({ status: order.orderStatus, note: `Delivery attempt failed: ${reason.trim()}`, changedBy: req.user.sub });
  }
  await order.save();
  await recordAudit(req, "SHIPMENT_STATUS_CHANGED", "Shipment", shipment._id, { orderNumber: order.orderNumber, status });
  await notifyUser({ recipient: shipment.distributor, type: "ORDER_STATUS", title: "Shipment update", message: `Shipment for ${shipment.orderNumber}: ${status.replaceAll("_", " ").toLowerCase()}. ${reason || note}`.trim(), link: "/dashboard/distributor/shipments", entityType: "Shipment", entityId: shipment.id, email: true });
  return shipment;
}

export async function confirmDelivery(req) {
  const { otp } = req.body || {};
  if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) throw fail("Enter the six-digit delivery OTP");
  const shipment = await Shipment.findOne({ order: req.params.orderId, distributor: req.user.sub }).select("+deliveryOtpHash");
  if (!shipment) throw fail("Shipment not found", 404);
  if (shipment.status !== "OUT_FOR_DELIVERY") throw fail("This shipment is not awaiting delivery confirmation", 409);
  if (shipment.otpLockedUntil && shipment.otpLockedUntil > Date.now()) throw fail("OTP verification is temporarily locked. Contact support.", 423);
  if (!shipment.deliveryOtpExpiresAt || shipment.deliveryOtpExpiresAt < Date.now()) throw fail("Delivery OTP has expired. Contact the company.", 410);
  if (hash(otp) !== shipment.deliveryOtpHash) {
    shipment.otpAttempts = (shipment.otpAttempts || 0) + 1;
    if (shipment.otpAttempts >= 5) {
      shipment.otpLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      shipment.deliveryOtpHash = "";
      shipment.deliveryOtpExpiresAt = null;
    }
    await shipment.save();
    throw fail(shipment.otpLockedUntil ? "Too many incorrect OTP attempts. Verification locked for 30 minutes." : "Incorrect delivery OTP", shipment.otpLockedUntil ? 423 : 401);
  }
  const order = await Order.findOne({ _id: shipment.order, distributor: req.user.sub });
  if (!order) throw fail("Order not found", 404);
  shipment.status = "DELIVERED";
  shipment.deliveredAt = new Date();
  shipment.deliveryOtpHash = "";
  shipment.deliveryOtpExpiresAt = null;
  shipment.otpAttempts = 0;
  shipment.otpLockedUntil = null;
  shipment.events.push({ status: "DELIVERED", note: "Distributor confirmed receipt using OTP", changedBy: req.user.sub });
  await shipment.save();
  order.orderStatus = "DELIVERED";
  order.shipment.deliveredAt = shipment.deliveredAt;
  order.statusHistory.push({ status: "DELIVERED", note: "Delivery confirmed by distributor using OTP", changedBy: req.user.sub });
  await order.save();
  await notifyUser({ recipient: req.user.sub, type: "ORDER_STATUS", title: "Delivery confirmed", message: `Your order ${order.orderNumber} has been marked delivered.`, link: "/dashboard/distributor/orders", entityType: "Order", entityId: order.id });
  return shipment;
}
