import mongoose from "mongoose";

const schema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  type: { type: String, enum: ["OPENING", "IN", "OUT", "ADJUSTMENT"], required: true },
  quantity: { type: Number, required: true, min: 1 },
  previousQuantity: { type: Number, required: true, min: 0 },
  newQuantity: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true, trim: true, maxlength: 300 },
  reference: { type: String, trim: true, maxlength: 100, default: "" },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

schema.index({ createdAt: -1 });
export default mongoose.model("StockMovement", schema);
