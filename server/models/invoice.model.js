import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  sku: String,
  name: String,
  quantity: Number,
  unitPrice: Number,
  lineTotal: Number
}, { _id: false });

const schema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
  distributor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  billTo: {
    name: String,
    email: String,
    companyName: String,
    gstin: String,
    phone: String,
    address: mongoose.Schema.Types.Mixed
  },
  items: [itemSchema],
  subtotal: { type: Number, required: true },
  taxAmount: { type: Number, default: 0 },
  shippingAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  issuedAt: { type: Date, default: Date.now },
  paymentReference: { type: String, default: "" }
}, { timestamps: true });

export default mongoose.model("Invoice", schema);
