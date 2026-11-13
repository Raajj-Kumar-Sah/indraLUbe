import mongoose from "mongoose";
import crypto from "node:crypto";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import DistributorProfile from "../models/distributorProfile.model.js";
import StockMovement from "../models/stockMovement.model.js";
import { recordAudit } from "./audit.js";
import { notifyUser, notifyRoles } from "./notification.service.js";
import { canTransitionOrder } from "./shipment.workflow.js";

const statuses = ["PLACED","CONFIRMED","PROCESSING","PACKED","DISPATCHED","OUT_FOR_DELIVERY","DELIVERED","CANCELLED"];
const money = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const orderNumber = () => `IND-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

async function distributorContext(userId, session) {
  const [user, profile] = await Promise.all([
    User.findById(userId).session(session),
    DistributorProfile.findOne({ user: userId }).session(session)
  ]);
  if (!user || user.role !== "DISTRIBUTOR" || !user.isActive || !user.emailVerifiedAt ||
      !profile || profile.approvalStatus !== "APPROVED") {
    throw Object.assign(new Error("An active, approved distributor account is required"), { status: 403 });
  }
  return { user, profile };
}

export async function createOrder(req) {
  const rawItems = req.body.items;
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 50) {
    throw Object.assign(new Error("Add between 1 and 50 distinct products"), { status: 400 });
  }
  const merged = new Map();
  for (const row of rawItems) {
    const id = String(row.productId || "");
    const qty = Number(row.quantity);
    if (!mongoose.isValidObjectId(id) || !Number.isInteger(qty) || qty < 1 || qty > 10000) {
      throw Object.assign(new Error("Each item needs a valid product and a whole quantity between 1 and 10000"), { status: 400 });
    }
    merged.set(id, (merged.get(id) || 0) + qty);
  }
  if (merged.size > 50) throw Object.assign(new Error("Too many products in one order"), { status: 400 });
  if (typeof req.body.notes === "string" && req.body.notes.length > 1000) throw Object.assign(new Error("Order notes are too long"), { status: 400 });

  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      const { user, profile } = await distributorContext(req.user.sub, session);
      const ids = [...merged.keys()];
      const products = await Product.find({ _id: { $in: ids }, isActive: true }).session(session);
      if (products.length !== ids.length) throw Object.assign(new Error("One or more products are unavailable"), { status: 409 });
      const items = [];
      let subtotal = 0;
      for (const product of products) {
        const quantity = merged.get(String(product._id));
        if (product.stockQuantity < quantity) throw Object.assign(new Error(`Insufficient stock for ${product.sku}. Available: ${product.stockQuantity}`), { status: 409 });
        const unitPrice = product.distributorPrice ?? product.price;
        const lineTotal = money(unitPrice * quantity);
        subtotal = money(subtotal + lineTotal);
        items.push({ product: product._id, sku: product.sku, name: product.name, division: product.division, quantity, unitPrice, lineTotal });
      }
      for (const item of items) {
        const changed = await Product.updateOne(
          { _id: item.product, isActive: true, stockQuantity: { $gte: item.quantity } },
          { $inc: { stockQuantity: -item.quantity }, $set: { updatedBy: user._id } },
          { session }
        );
        if (changed.modifiedCount !== 1) throw Object.assign(new Error(`Stock changed while placing order for ${item.sku}. Please retry.`), { status: 409 });
        await StockMovement.create([{
          product: item.product, type: "OUT", quantity: item.quantity,
          previousQuantity: (products.find(p => String(p._id) === String(item.product)).stockQuantity),
          newQuantity: (products.find(p => String(p._id) === String(item.product)).stockQuantity - item.quantity),
          reason: "Reserved for order placement", reference: "ORDER_PENDING", performedBy: user._id
        }], { session });
      }
      const distributorSnapshot = {
        name: user.name, email: user.email, companyName: profile.companyName,
        phone: profile.phone, gstin: profile.gstin, address: profile.address?.toObject?.() || profile.address
      };
      const [order] = await Order.create([{
        orderNumber: orderNumber(), distributor: user._id, distributorSnapshot, items,
        subtotal, taxAmount: 0, shippingAmount: 0, totalAmount: subtotal,
        notes: req.body.notes || "",
        statusHistory: [{ status: "PLACED", note: "Order submitted by distributor", changedBy: user._id }]
      }], { session });
      created = order;
    });
  } finally { await session.endSession(); }
  await recordAudit(req, "ORDER_PLACED", "Order", created._id, { orderNumber: created.orderNumber, totalAmount: created.totalAmount });
  await Promise.all([
    notifyUser({ recipient: created.distributor, type: "ORDER_PLACED", title: "Order received", message: `Your order ${created.orderNumber} has been placed successfully.`, link: "/dashboard/distributor/orders", entityType: "Order", entityId: created.id }),
    notifyRoles(["ADMIN", "SUPER_ADMIN"], { type: "ORDER_PLACED", title: "New distributor order", message: `Order ${created.orderNumber} has been placed and requires review.`, link: "/dashboard/admin/orders", entityType: "Order", entityId: created.id })
  ]);
  return created;
}

export async function listMyOrders(req, query = {}) {
  const filter = { distributor: req.user.sub };
  if (query.status && statuses.includes(query.status)) filter.orderStatus = query.status;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter)
  ]);
  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getMyOrder(req, id) {
  const order = await Order.findOne({ _id: id, distributor: req.user.sub }).lean();
  if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
  return order;
}

export async function listAllOrders(query = {}) {
  const filter = {};
  if (query.status && statuses.includes(query.status)) filter.orderStatus = query.status;
  if (query.paymentStatus && ["PENDING", "PAID", "PARTIALLY_PAID", "FAILED", "REFUNDED"].includes(query.paymentStatus)) filter.paymentStatus = query.paymentStatus;
  if (query.search) {
    const term = String(query.search).trim().slice(0, 80);
    filter.$or = [
      { orderNumber: new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      { "distributorSnapshot.companyName": new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }
    ];
  }
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const [items, total, placed, pendingPayment, awaiting] = await Promise.all([
    Order.find(filter).populate("distributor", "name email").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
    Order.countDocuments(),
    Order.countDocuments({ paymentStatus: "PENDING" }),
    Order.countDocuments({ orderStatus: { $in: ["PLACED", "CONFIRMED"] } })
  ]);
  return { items, summary: { total: placed, pendingPayment, awaitingAction: awaiting }, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getAdminOrder(id) {
  const order = await Order.findById(id).populate("distributor", "name email").lean();
  if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
  return order;
}

export async function updateOrderStatus(req) {
  const { status, note = "" } = req.body;
  if (!statuses.includes(status) || typeof note !== "string" || note.length > 300) {
    throw Object.assign(new Error("Valid order status and note are required"), { status: 400 });
  }
  if (["DISPATCHED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(status)) {
    throw Object.assign(new Error("Use the shipment operations workflow for dispatch and delivery statuses"), { status: 409 });
  }
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await Order.findById(req.params.id).session(session);
      if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
      if (!canTransitionOrder(order.orderStatus, status)) {
        throw Object.assign(new Error(`Cannot change order from ${order.orderStatus} to ${status}`), { status: 409 });
      }
      if (status === "CANCELLED") {
        if (order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_PAID") {
          throw Object.assign(new Error("Paid orders require a refund workflow before cancellation"), { status: 409 });
        }
        for (const item of order.items) {
          const product = await Product.findByIdAndUpdate(item.product, { $inc: { stockQuantity: item.quantity } }, { new: true, session });
          if (product) await StockMovement.create([{
            product: item.product, type: "IN", quantity: item.quantity,
            previousQuantity: product.stockQuantity - item.quantity, newQuantity: product.stockQuantity,
            reason: "Stock released after order cancellation", reference: order.orderNumber, performedBy: req.user.sub
          }], { session });
        }
        order.cancelledAt = new Date();
      }
      order.orderStatus = status;
      order.statusHistory.push({ status, note, changedBy: req.user.sub, changedAt: new Date() });
      await order.save({ session });
    });
  } finally { await session.endSession(); }
  await recordAudit(req, "ORDER_STATUS_CHANGED", "Order", order._id, { orderNumber: order.orderNumber, status });
  await notifyUser({ recipient: order.distributor, type: "ORDER_STATUS", title: "Order status updated", message: `Order ${order.orderNumber} is now ${status.replaceAll("_", " ").toLowerCase()}.`, link: "/dashboard/distributor/orders", entityType: "Order", entityId: order.id });
  return order;
}

export async function updateShipment(req) {
  const { carrier = "", trackingNumber = "", trackingUrl = "", estimatedDelivery = null } = req.body;
  if ([carrier, trackingNumber, trackingUrl].some(v => typeof v !== "string") || carrier.length > 100 || trackingNumber.length > 120 || trackingUrl.length > 500) {
    throw Object.assign(new Error("Invalid shipment details"), { status: 400 });
  }
  if (trackingUrl && !/^https:\/\/\S+$/i.test(trackingUrl)) throw Object.assign(new Error("Tracking URL must use HTTPS"), { status: 400 });
  const order = await Order.findById(req.params.id);
  if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
  if (["DELIVERED", "CANCELLED"].includes(order.orderStatus)) throw Object.assign(new Error("Shipment cannot be changed for a closed order"), { status: 409 });
  order.shipment = { ...order.shipment.toObject(), carrier: carrier.trim(), trackingNumber: trackingNumber.trim(), trackingUrl: trackingUrl.trim(), estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null };
  await order.save();
  await recordAudit(req, "SHIPMENT_UPDATED", "Order", order._id, { orderNumber: order.orderNumber });
  return order;
}
