import mongoose from "mongoose";

const schema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  action: { type: String, required: true, maxlength: 100 },
  entityType: { type: String, required: true, maxlength: 80 },
  entityId: { type: String, default: "" },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, maxlength: 80, default: "" }
}, { timestamps: true });

schema.index({ createdAt: -1 });
export default mongoose.model("AuditLog", schema);
