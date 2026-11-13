import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import AuthEvent from "../models/authEvent.model.js";
import AuthToken from "../models/authToken.model.js";
import DistributorProfile from "../models/distributorProfile.model.js";
import { verifyPassword, hashPassword } from "../utils/password.js";
import { sendTransactionalEmail } from "./email.js";
import { recordAudit } from "./audit.js";
import { notifyRoles } from "./notification.service.js";

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

const hashToken = value => crypto.createHash("sha256").update(value).digest("hex");

function accessToken(user) {
  if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32) {
    throw new Error("JWT_ACCESS_SECRET must be configured with at least 32 characters");
  }
  return jwt.sign(
    { sub: user.id || user._id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: "15m",
      issuer: process.env.JWT_ISSUER || "indira-api",
      audience: process.env.JWT_AUDIENCE || "indira-client"
    }
  );
}

async function createRefreshToken(userId) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await AuthToken.create({
    user: userId,
    tokenHash,
    purpose: "REFRESH_TOKEN",
    expiresAt
  });
  return rawToken;
}

async function event(req, ev, user, email, details = "") {
  await AuthEvent.create({
    user: user?._id || null,
    email: email || "",
    event: ev,
    ip: req?.ip || "",
    userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 300),
    details
  });
}

export async function loginWithPassword(email, password, req) {
  const normalized = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalized }).select("+passwordHash");
  if (!user) {
    await event(req, "LOGIN_FAILED", null, normalized, "Unknown account");
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });
  }
  if (user.lockUntil && user.lockUntil > Date.now()) {
    await event(req, "LOGIN_LOCKED", user, normalized, "Account temporarily locked");
    throw Object.assign(new Error("Account temporarily locked. Try again later."), { status: 423 });
  }
  if (!user.isActive || !user.emailVerifiedAt) {
    await event(req, "LOGIN_FAILED", user, normalized, "Inactive or unverified account");
    throw Object.assign(new Error("Invalid credentials or account is pending approval / unverified"), { status: 401 });
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= MAX_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_MS);
    }
    await user.save();
    await event(req, user.lockUntil ? "LOGIN_LOCKED" : "LOGIN_FAILED", user, normalized, `Failed attempt ${user.failedLoginAttempts}`);
    throw Object.assign(new Error(user.lockUntil ? "Too many failed attempts. Account locked for 15 minutes." : "Invalid credentials"), {
      status: user.lockUntil ? 423 : 401
    });
  }
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();
  await event(req, "LOGIN_SUCCESS", user, normalized);

  const token = accessToken(user);
  const refreshToken = await createRefreshToken(user._id);

  return {
    accessToken: token,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  };
}

export async function rotateRefreshToken(rawToken, req) {
  if (typeof rawToken !== "string" || rawToken.length !== 64) {
    throw Object.assign(new Error("Invalid refresh token"), { status: 401 });
  }
  const tokenHash = hashToken(rawToken);
  const tokenRecord = await AuthToken.findOne({ tokenHash, purpose: "REFRESH_TOKEN" });

  if (!tokenRecord) {
    throw Object.assign(new Error("Invalid refresh token"), { status: 401 });
  }

  // Token reuse detection: if token is already marked as used, compromise detected!
  if (tokenRecord.usedAt !== null) {
    console.warn(`[Security Alert] Refresh token reuse detected for user ${tokenRecord.user}! Revoking all sessions.`);
    await AuthToken.deleteMany({ user: tokenRecord.user, purpose: "REFRESH_TOKEN" });
    await event(req, "TOKEN_REUSE_DETECTED", null, "", `Reuse detected for token user ${tokenRecord.user}`);
    throw Object.assign(new Error("Security violation detected. Please sign in again."), { status: 401 });
  }

  if (tokenRecord.expiresAt < new Date()) {
    throw Object.assign(new Error("Refresh token expired"), { status: 401 });
  }

  // Invalidate current refresh token
  tokenRecord.usedAt = new Date();
  await tokenRecord.save();

  const user = await User.findById(tokenRecord.user);
  if (!user || !user.isActive || !user.emailVerifiedAt) {
    throw Object.assign(new Error("Account is no longer active or valid"), { status: 401 });
  }

  // Issue new pair (rotation)
  const newAccessToken = accessToken(user);
  const newRefreshToken = await createRefreshToken(user._id);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  };
}

export async function revokeRefreshToken(rawToken) {
  if (typeof rawToken !== "string" || rawToken.length !== 64) return;
  const tokenHash = hashToken(rawToken);
  await AuthToken.deleteOne({ tokenHash, purpose: "REFRESH_TOKEN" });
}

export async function registerDistributor(body, req) {
  const { name, email, password, companyName, contactPerson, phone, gstin, businessType, address, territories } = body || {};

  if (!name || typeof name !== "string" || !name.trim() || name.length > 100) {
    throw Object.assign(new Error("Contact name is required (up to 100 characters)"), { status: 400 });
  }
  if (!email || typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    throw Object.assign(new Error("A valid email address is required"), { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8 || password.length > 72) {
    throw Object.assign(new Error("Password must be between 8 and 72 characters"), { status: 400 });
  }
  if (!companyName || typeof companyName !== "string" || !companyName.trim() || companyName.length > 180) {
    throw Object.assign(new Error("Registered company name is required"), { status: 400 });
  }
  if (phone && !/^[+0-9() -]{7,20}$/.test(phone)) {
    throw Object.assign(new Error("Enter a valid phone number"), { status: 400 });
  }
  if (gstin && !/^[0-9A-Z]{15}$/.test(gstin.toUpperCase())) {
    throw Object.assign(new Error("GSTIN must contain 15 alphanumeric characters"), { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw Object.assign(new Error("An account with this email already exists"), { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: "DISTRIBUTOR",
    isActive: false,
    emailVerifiedAt: null
  });

  await DistributorProfile.create({
    user: user._id,
    companyName: companyName.trim(),
    contactPerson: (contactPerson || name).trim(),
    phone: phone ? phone.trim() : "",
    gstin: gstin ? gstin.toUpperCase().trim() : "",
    businessType: businessType || "DISTRIBUTOR",
    address: address || {},
    territories: Array.isArray(territories) ? territories : [],
    approvalStatus: "PENDING"
  });

  await requestEmailVerification(user, req);
  await event(req, "DISTRIBUTOR_REGISTERED", user, user.email, "Distributor registration submitted");

  await notifyRoles(["ADMIN", "SUPER_ADMIN"], {
    type: "DISTRIBUTOR_REGISTERED",
    title: "New distributor application",
    message: `${companyName} (${name}) registered as a distributor and requires review.`,
    link: "/dashboard/admin/distributors",
    entityType: "User",
    entityId: user.id
  });

  return {
    success: true,
    message: "Registration submitted successfully. Please check your email to verify your address. Admin approval is required before logging in."
  };
}

export async function requestPasswordReset(email, req) {
  const normalized = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalized });
  if (!user || !user.isActive || !user.emailVerifiedAt) return;
  await AuthToken.deleteMany({ user: user._id, purpose: "PASSWORD_RESET" });
  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  await AuthToken.create({ user: user._id, tokenHash, purpose: "PASSWORD_RESET", expiresAt: new Date(Date.now() + 30 * 60 * 1000) });
  const url = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password?token=${raw}`;
  await sendTransactionalEmail({
    to: user.email,
    subject: "Reset your Indira Industries password",
    htmlText: `<p>We received a request to reset your password.</p><p><a href="${url}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request this, ignore this email.</p>`,
    textContent: `Reset your password using this link (expires in 30 minutes): ${url}`
  });
  await event(req, "PASSWORD_RESET_REQUESTED", user, user.email);
}

export async function resetPassword(raw, newPassword, req) {
  if (typeof raw !== "string" || raw.length !== 64) throw Object.assign(new Error("Invalid or expired reset link"), { status: 400 });
  const token = await AuthToken.findOne({ tokenHash: hashToken(raw), purpose: "PASSWORD_RESET", usedAt: null, expiresAt: { $gt: new Date() } });
  if (!token) throw Object.assign(new Error("Invalid or expired reset link"), { status: 400 });
  const user = await User.findById(token.user);
  if (!user) throw Object.assign(new Error("Invalid or expired reset link"), { status: 400 });
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();
  token.usedAt = new Date();
  await token.save();
  await AuthToken.deleteMany({ user: user._id, purpose: "PASSWORD_RESET", _id: { $ne: token._id } });
  await event(req, "PASSWORD_RESET_COMPLETED", user, user.email);
}

export async function requestEmailVerification(user, req) {
  if (user.emailVerifiedAt) return;
  await AuthToken.deleteMany({ user: user._id, purpose: "EMAIL_VERIFY" });
  const raw = crypto.randomBytes(32).toString("hex");
  await AuthToken.create({ user: user._id, tokenHash: hashToken(raw), purpose: "EMAIL_VERIFY", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  const url = `${process.env.CLIENT_URL || "http://localhost:5173"}/verify-email?token=${raw}`;
  await sendTransactionalEmail({
    to: user.email,
    subject: "Verify your Indira Industries email",
    htmlText: `<p>Welcome to Indira Industries.</p><p><a href="${url}">Click here to verify your email address</a></p><p>This link expires in 24 hours.</p>`,
    textContent: `Verify your email: ${url}`
  });
}

export async function verifyEmail(raw, req) {
  if (typeof raw !== "string" || raw.length !== 64) throw Object.assign(new Error("Invalid or expired verification link"), { status: 400 });
  const token = await AuthToken.findOne({ tokenHash: hashToken(raw), purpose: "EMAIL_VERIFY", usedAt: null, expiresAt: { $gt: new Date() } });
  if (!token) throw Object.assign(new Error("Invalid verification link"), { status: 400 });
  const user = await User.findById(token.user);
  if (!user) throw Object.assign(new Error("Invalid verification link"), { status: 400 });
  user.emailVerifiedAt = new Date();
  await user.save();
  token.usedAt = new Date();
  await token.save();
  await event(req, "EMAIL_VERIFIED", user, user.email);
}
