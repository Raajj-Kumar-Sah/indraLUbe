import mongoose from "mongoose";

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
  division: { type: String, required: true, enum: ["IINDLUBE", "IINDPURE", "IINDSTYL", "Corporate"] },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

schema.index({ division: 1, isActive: 1 });
export default mongoose.model("Category", schema);
