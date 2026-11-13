import mongoose from "mongoose";

const schema = new mongoose.Schema({
  companyName: { type: String, required: true, trim: true },
  applicantName: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  investmentCapacity: { type: String, default: "" },
  storageSpace: { type: String, default: "" },
  experienceYears: { type: String, default: "" },
  message: { type: String, default: "" },
  status: {
    type: String,
    enum: ["NEW", "UNDER_REVIEW", "CONTACTED", "APPROVED", "REJECTED"],
    default: "NEW",
    index: true
  },
  adminNotes: { type: String, default: "" }
}, { timestamps: true });

schema.index({ createdAt: -1 });
export default mongoose.model("PartnershipInquiry", schema);
