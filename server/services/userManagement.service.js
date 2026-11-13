/**
 * userManagement.service.js
 * Business logic for Super Admin user management operations.
 */
import mongoose from "mongoose";
import User from "../models/user.model.js";
import AuthToken from "../models/authToken.model.js";
import DistributorProfile from "../models/distributorProfile.model.js";
import { hashPassword } from "../utils/password.js";
import AuditLog from "../models/auditLog.model.js";

/** Thin wrapper so service can audit without a full req object */
async function audit(action, entityId, performedBy, details) {
  try {
    await AuditLog.create({
      actor: performedBy,
      action,
      entityType: "User",
      entityId: String(entityId),
      details,
      ip: "server"
    });
  } catch { /* non-fatal */ }
}

/** Allowed roles that super admin can manage */
const MANAGEABLE_ROLES = ["ADMIN", "HR", "DISTRIBUTOR"];

/**
 * List users with optional filters.
 */
export async function listUsers({ role, status, search, page = 1, limit = 20 }) {
  const filter = {};

  if (role && MANAGEABLE_ROLES.includes(role)) {
    filter.role = role;
  } else {
    // Show all non-super-admin users by default
    filter.role = { $in: MANAGEABLE_ROLES };
  }

  if (status === "ACTIVE") {
    filter.isActive = true;
  } else if (status === "BLOCKED") {
    filter.isActive = false;
    filter.suspendedUntil = { $exists: false };
    filter.blockedAt = { $exists: true };
  } else if (status === "SUSPENDED") {
    filter.suspendedUntil = { $exists: true, $gt: new Date() };
  }

  if (search && search.trim()) {
    const re = new RegExp(search.trim(), "i");
    filter.$or = [{ name: re }, { email: re }];
  }

  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(filter)
      .select("name email role isActive emailVerifiedAt createdAt suspendedUntil blockedAt failedLoginAttempts lockUntil")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter)
  ]);

  return {
    data: users.map(u => ({
      ...u,
      status: deriveStatus(u)
    })),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) }
  };
}

function deriveStatus(u) {
  if (u.suspendedUntil && new Date(u.suspendedUntil) > new Date()) return "SUSPENDED";
  if (u.blockedAt) return "BLOCKED";
  if (!u.isActive) return "INACTIVE";
  if (!u.emailVerifiedAt) return "UNVERIFIED";
  return "ACTIVE";
}

/**
 * Create a new staff / HR / Admin account managed by super admin.
 * Password is set directly — no email verification required (admin-created accounts).
 */
export async function createManagedUser(body, adminId) {
  const { name, email, password, role } = body;

  if (!name || !email || !password || !role) {
    const err = new Error("name, email, password, and role are required.");
    err.status = 400;
    throw err;
  }
  if (!MANAGEABLE_ROLES.includes(role)) {
    const err = new Error(`role must be one of: ${MANAGEABLE_ROLES.join(", ")}`);
    err.status = 400;
    throw err;
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    const err = new Error("An account with this email already exists.");
    err.status = 409;
    throw err;
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    isActive: true,
    emailVerifiedAt: new Date(), // admin-created accounts are pre-verified
    authProvider: "LOCAL"
  });

  // If the super admin created a DISTRIBUTOR, automatically initialize their approved DistributorProfile
  if (role === "DISTRIBUTOR") {
    await DistributorProfile.create({
      user: user._id,
      companyName: body.companyName?.trim() || `${user.name} Enterprises`,
      contactPerson: user.name,
      phone: body.phone?.trim() || "",
      businessType: "DISTRIBUTOR",
      approvalStatus: "APPROVED",
      approvedBy: adminId,
      approvedAt: new Date(),
      approvalNote: "Directly onboarded by Super Admin"
    }).catch(err => console.warn("Failed to auto-create distributor profile:", err.message));
  }

  await audit("USER_CREATED", user._id, adminId, `Created ${role} account for ${user.email}`);

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/**
 * Block, suspend or activate a user.
 */
export async function updateUserStatus(userId, action, adminId) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("User not found."); err.status = 404; throw err;
  }

  if (action === "BLOCK") {
    user.isActive = false;
    user.blockedAt = new Date();
    user.suspendedUntil = undefined;
    // Revoke all refresh tokens immediately
    await AuthToken.deleteMany({ user: user._id, purpose: "REFRESH_TOKEN" });
  } else if (action === "SUSPEND") {
    // Suspend for 7 days by default
    user.suspendedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.isActive = false;
    user.blockedAt = undefined;
    await AuthToken.deleteMany({ user: user._id, purpose: "REFRESH_TOKEN" });
  } else if (action === "ACTIVATE") {
    user.isActive = true;
    user.blockedAt = undefined;
    user.suspendedUntil = undefined;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
  }

  await user.save();

  await audit(`USER_${action}ED`, user._id, adminId, `${action} applied to ${user.email}`);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: deriveStatus(user.toObject())
  };
}

/**
 * Set a new password for any user (super admin privilege).
 */
export async function setUserPassword(userId, plainPassword, adminId) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("User not found."); err.status = 404; throw err;
  }

  user.passwordHash = await hashPassword(plainPassword);
  user.passwordChangedAt = new Date();
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  // Revoke all existing refresh tokens so old sessions are invalidated
  await AuthToken.deleteMany({ user: user._id, purpose: "REFRESH_TOKEN" });

  await audit("PASSWORD_RESET_BY_ADMIN", user._id, adminId, `Password forcibly set for ${user.email}`);
}

/**
 * Permanently delete a user account.
 */
export async function deleteUser(userId, adminId) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("User not found."); err.status = 404; throw err;
  }

  await AuthToken.deleteMany({ user: user._id });
  await User.findByIdAndDelete(userId);

  await audit("USER_DELETED", new mongoose.Types.ObjectId(userId), adminId, `Permanently deleted: ${user.email} (${user.role})`);
}
