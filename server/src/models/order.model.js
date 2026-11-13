import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  division: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 }
}, { _id: false });

const timelineSchema = new mongoose.Schema({
  status: { type: String, required: true },
  note: { type: String, trim: true, maxlength: 300, default: "" },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  changedAt: { type: Date, default: Date.now }
}, { _id: false });

const schema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  distributor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  distributorSnapshot: {
    name: String, email: String, companyName: String, phone: String, gstin: String,
    address: { line1: String, line2: String, city: String, state: String, postalCode: String, country: String }
  },
  items: { type: [itemSchema], required: true, validate: v => v.length > 0 },
  subtotal: { type: Number, required: true, min: 0 },
  taxAmount: { type: Number, default: 0, min: 0 },
  shippingAmount: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "INR", enum: ["INR"] },
  paymentStatus: { type: String, enum: ["PENDING", "PAID", "PARTIALLY_PAID", "FAILED", "REFUNDED"], default: "PENDING", index: true },
  paymentMethod: { type: String, enum: ["RAZORPAY", "BANK_TRANSFER", "CREDIT_TERMS", "OFFLINE", "UNSPECIFIED"], default: "UNSPECIFIED" },
  orderStatus: { type: String, enum: ["PLACED", "CONFIRMED", "PROCESSING", "PACKED", "DISPATCHED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"], default: "PLACED", index: true },
  shipment: {
    carrier: { type: String, trim: true, maxlength: 100, default: "" },
    trackingNumber: { type: String, trim: true, maxlength: 120, default: "" },
    trackingUrl: { type: String, trim: true, maxlength: 500, default: "" },
    estimatedDelivery: { type: Date, default: null },
    dispatchedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null }
  },
  notes: { type: String, trim: true, maxlength: 1000, default: "" },
  statusHistory: { type: [timelineSchema], default: [] },
  cancelledAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

schema.index({ distributor: 1, createdAt: -1 });
schema.index({ orderStatus: 1, paymentStatus: 1, createdAt: -1 });
export default mongoose.model("Order", schema);
