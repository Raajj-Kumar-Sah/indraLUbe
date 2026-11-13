import mongoose from "mongoose";

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  email: { type: String, lowercase: true, trim: true, maxlength: 254, default: "" },
  event: {
    type: String,
    enum: [
      "LOGIN_SUCCESS",
      "LOGIN_FAILED",
      "LOGIN_LOCKED",
      "PASSWORD_RESET_REQUESTED",
      "PASSWORD_RESET_COMPLETED",
      "EMAIL_VERIFIED",
      "DISTRIBUTOR_REGISTERED",
      "TOKEN_REUSE_DETECTED"
    ],
    required: true
  },
  ip: { type: String, maxlength: 80, default: "" },
  userAgent: { type: String, maxlength: 300, default: "" },
  details: { type: String, maxlength: 300, default: "" }
}, { timestamps: true });

schema.index({ createdAt: -1 });
export default mongoose.model("AuthEvent", schema);
