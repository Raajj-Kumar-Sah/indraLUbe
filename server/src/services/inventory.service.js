import mongoose from "mongoose";
import Product from "../models/product.model.js";
import StockMovement from "../models/stockMovement.model.js";
import { recordAudit } from "./audit.js";

export async function getInventory(query = {}) {
  const filter = {};
  if (query.division) filter.division = query.division;
  if (query.stock === "low") filter.$expr = { $and: [{ $gt: ["$stockQuantity", 0] }, { $lte: ["$stockQuantity", "$reorderLevel"] }] };
  if (query.stock === "out") filter.stockQuantity = 0;
  if (query.stock === "healthy") filter.$expr = { $gt: ["$stockQuantity", "$reorderLevel"] };
  const items = await Product.find(filter).populate("category", "name").sort({ stockQuantity: 1 }).lean();
  const [total, low, out] = await Promise.all([
    Product.countDocuments(), Product.countDocuments({ $expr: { $and: [{ $gt: ["$stockQuantity", 0] }, { $lte: ["$stockQuantity", "$reorderLevel"] }] } }),
    Product.countDocuments({ stockQuantity: 0 })
  ]);
  return { items, summary: { trackedSkus: total, lowStock: low, outOfStock: out } };
}

export async function adjustStock(req) {
  const { quantity, type, reason, reference = "" } = req.body;
  const amount = Number(quantity);
  if (!Number.isInteger(amount) || amount < 1 || !["IN", "OUT", "ADJUSTMENT"].includes(type) || !String(reason || "").trim()) {
    throw Object.assign(new Error("Provide a positive whole quantity, valid movement type and reason"), { status: 400 });
  }
  const session = await mongoose.startSession();
  let updated;
  try {
    await session.withTransaction(async () => {
      const product = await Product.findById(req.params.id).session(session);
      if (!product) throw Object.assign(new Error("Product not found"), { status: 404 });
      const previous = product.stockQuantity;
      const next = type === "IN" ? previous + amount : type === "OUT" ? previous - amount : amount;
      if (next < 0) throw Object.assign(new Error("Stock cannot become negative"), { status: 409 });
      product.stockQuantity = next;
      product.updatedBy = req.user.sub;
      await product.save({ session });
      await StockMovement.create([{
        product: product._id, type, quantity: amount, previousQuantity: previous,
        newQuantity: next, reason: String(reason).trim(), reference, performedBy: req.user.sub
      }], { session });
      updated = product;
    });
  } finally { await session.endSession(); }
  await recordAudit(req, "STOCK_ADJUSTED", "Product", updated._id, { type, quantity: amount, newQuantity: updated.stockQuantity });
  return updated;
}

export async function getMovements(req) {
  const filter = {};
  if (req.query.productId) filter.product = req.query.productId;
  return StockMovement.find(filter).populate("product", "sku name division").populate("performedBy", "name email").sort({ createdAt: -1 }).limit(Math.min(200, Number(req.query.limit) || 50)).lean();
}
