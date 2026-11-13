import mongoose from "mongoose";

const schema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
  distributor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  provider: { type: String, enum: ["RAZORPAY", "BANK_TRANSFER", "OFFLINE"], default: "RAZORPAY" },
  providerOrderId: { type: String, default: "", index: true },
  providerPaymentId: { type: String, default: "", index: true, sparse: true },
  amount: { type: Number, required: true, min: 0 },
  amountPaise: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "INR" },
  status: { type: String, enum: ["CREATED", "AUTHORIZED", "CAPTURED", "FAILED", "REFUNDED"], default: "CREATED", index: true },
  failureReason: { type: String, default: "" },
  capturedAt: { type: Date, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

schema.index({ providerOrderId: 1, providerPaymentId: 1 });
export default mongoose.model("Payment", schema);
