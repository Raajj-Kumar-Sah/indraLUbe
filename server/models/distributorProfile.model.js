import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
  line1: { type: String, trim: true, maxlength: 180, default: "" },
  line2: { type: String, trim: true, maxlength: 180, default: "" },
  city: { type: String, trim: true, maxlength: 100, default: "" },
  state: { type: String, trim: true, maxlength: 100, default: "" },
  postalCode: { type: String, trim: true, maxlength: 12, default: "" },
  country: { type: String, trim: true, maxlength: 80, default: "India" }
}, { _id: false });

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  companyName: { type: String, trim: true, maxlength: 180, default: "" },
  contactPerson: { type: String, trim: true, maxlength: 100, default: "" },
  phone: { type: String, trim: true, maxlength: 20, default: "" },
  gstin: { type: String, trim: true, uppercase: true, maxlength: 15, default: "" },
  businessType: { type: String, enum: ["RETAILER", "WHOLESALER", "DEALER", "DISTRIBUTOR", "OTHER"], default: "OTHER" },
  address: { type: addressSchema, default: () => ({}) },
  territories: [{ type: String, trim: true, maxlength: 100 }],
  approvalStatus: { type: String, enum: ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"], default: "PENDING", index: true },
  approvalNote: { type: String, trim: true, maxlength: 500, default: "" },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  approvedAt: { type: Date, default: null },
  creditLimit: { type: Number, min: 0, default: 0 },
  paymentTermsDays: { type: Number, min: 0, max: 180, default: 0 }
}, { timestamps: true });

schema.index({ approvalStatus: 1, createdAt: -1 });
schema.index({ companyName: "text", gstin: "text", phone: "text" });
export default mongoose.model("DistributorProfile", schema);
