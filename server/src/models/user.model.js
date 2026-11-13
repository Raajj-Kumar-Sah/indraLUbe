import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, select: false, default: null },
  googleId: { type: String, unique: true, sparse: true, select: false },
  authProvider: {
    type: String,
    enum: ["LOCAL", "GOOGLE", "LOCAL_AND_GOOGLE"],
    default: "LOCAL"
  },
  role: {
    type: String,
    enum: ["SUPER_ADMIN", "ADMIN", "HR", "DISTRIBUTOR"],
    required: true
  },
  isActive: { type: Boolean, default: false },
  emailVerifiedAt: { type: Date, default: null },
  failedLoginAttempts: { type: Number, default: 0, min: 0 },
  lockUntil: { type: Date, default: null },
  passwordChangedAt: { type: Date, default: null },
  // Super admin moderation fields
  blockedAt: { type: Date, default: null },
  suspendedUntil: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model("User", userSchema);
