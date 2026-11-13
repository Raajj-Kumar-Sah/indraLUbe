import mongoose from "mongoose";

const schema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  category: {
    type: String,
    enum: ["CATALOG", "PARTNERSHIP_FORM", "AGREEMENT", "BROCHURE", "OTHER"],
    default: "OTHER"
  },
  division: {
    type: String,
    enum: ["IINDLUBE", "IINDPURE", "IINDSTYL", "ALL"],
    default: "IINDLUBE"
  },
  fileUrl: { type: String, required: true },
  cloudinaryPublicId: { type: String, default: "" },
  fileName: { type: String, default: "" },
  fileSize: { type: Number, default: 0 },
  mimeType: { type: String, default: "application/pdf" },
  version: { type: Number, default: 1 },
  isPublished: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

const EnterpriseDocument = mongoose.model("EnterpriseDocument", schema);
export default EnterpriseDocument;
export { EnterpriseDocument };
