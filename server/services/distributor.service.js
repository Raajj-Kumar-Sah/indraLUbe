import mongoose from "mongoose";
import User from "../models/user.model.js";
import DistributorProfile from "../models/distributorProfile.model.js";
import { recordAudit } from "./audit.js";

const validStatuses = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];

function normalizeProfile(body = {}) {
  const allowed = ["companyName", "contactPerson", "phone", "gstin", "businessType", "territories", "address"];
  const data = {};
  for (const key of allowed) if (body[key] !== undefined) data[key] = body[key];
  if (data.phone && !/^[+0-9() -]{7,20}$/.test(data.phone)) {
    throw Object.assign(new Error("Enter a valid phone number"), { status: 400 });
  }
  if (data.gstin && !/^[0-9A-Z]{15}$/.test(data.gstin.toUpperCase())) {
    throw Object.assign(new Error("GSTIN must contain 15 letters/numbers"), { status: 400 });
  }
  if (data.territories && (!Array.isArray(data.territories) || data.territories.length > 30)) {
    throw Object.assign(new Error("Territories must be an array of up to 30 entries"), { status: 400 });
  }
  return data;
}

export async function listDistributors(query = {}) {
  const filter = { role: "DISTRIBUTOR" };
  if (query.status && validStatuses.includes(query.status)) {
    const profiles = await DistributorProfile.find({ approvalStatus: query.status }).select("user").lean();
    filter._id = { $in: profiles.map(p => p.user) };
  }
  if (query.active === "true") filter.isActive = true;
  if (query.active === "false") filter.isActive = false;
  if (query.search) {
    const term = String(query.search).trim().slice(0, 100);
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: regex }, { email: regex }];
  }
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const [users, total] = await Promise.all([
    User.find(filter).select("name email role isActive emailVerifiedAt createdAt").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter)
  ]);
  const profiles = await DistributorProfile.find({ user: { $in: users.map(u => u._id) } }).lean();
  const byUser = new Map(profiles.map(p => [String(p.user), p]));
  return {
    items: users.map(u => ({ ...u, profile: byUser.get(String(u._id)) || null })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
}

export async function getDistributor(id) {
  if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error("Invalid distributor ID"), { status: 400 });
  const user = await User.findOne({ _id: id, role: "DISTRIBUTOR" }).select("name email role isActive emailVerifiedAt createdAt").lean();
  if (!user) throw Object.assign(new Error("Distributor not found"), { status: 404 });
  const profile = await DistributorProfile.findOne({ user: id }).lean();
  return { ...user, profile };
}

export async function updateDistributorProfile(req) {
  const user = await User.findOne({ _id: req.params.id, role: "DISTRIBUTOR" });
  if (!user) throw Object.assign(new Error("Distributor not found"), { status: 404 });
  const data = normalizeProfile(req.body);
  if (req.body.creditLimit !== undefined) {
    const value = Number(req.body.creditLimit);
    if (!Number.isFinite(value) || value < 0) throw Object.assign(new Error("Credit limit must be a non-negative number"), { status: 400 });
    data.creditLimit = value;
  }
  if (req.body.paymentTermsDays !== undefined) {
    const value = Number(req.body.paymentTermsDays);
    if (!Number.isInteger(value) || value < 0 || value > 180) throw Object.assign(new Error("Payment terms must be between 0 and 180 days"), { status: 400 });
    data.paymentTermsDays = value;
  }
  const profile = await DistributorProfile.findOneAndUpdate(
    { user: user._id }, { $set: data, $setOnInsert: { approvalStatus: "PENDING" } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await recordAudit(req, "DISTRIBUTOR_PROFILE_UPDATED", "DistributorProfile", profile._id, { distributorId: String(user._id) });
  return { ...user.toObject(), profile };
}

export async function changeDistributorStatus(req) {
  const { status, note = "" } = req.body;
  if (!validStatuses.includes(status)) throw Object.assign(new Error("Invalid distributor status"), { status: 400 });
  if (typeof note !== "string" || note.length > 500) throw Object.assign(new Error("Approval note must be 500 characters or fewer"), { status: 400 });
  const user = await User.findOne({ _id: req.params.id, role: "DISTRIBUTOR" });
  if (!user) throw Object.assign(new Error("Distributor not found"), { status: 404 });
  const profile = await DistributorProfile.findOneAndUpdate(
    { user: user._id },
    { $set: {
      approvalStatus: status, approvalNote: note.trim(),
      approvedBy: status === "APPROVED" ? req.user.sub : null,
      approvedAt: status === "APPROVED" ? new Date() : null
    }, $setOnInsert: { user: user._id } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  user.isActive = status === "APPROVED" && Boolean(user.emailVerifiedAt);
  await user.save();
  await recordAudit(req, `DISTRIBUTOR_${status}`, "DistributorProfile", profile._id, {
    distributorId: String(user._id), emailVerified: Boolean(user.emailVerifiedAt), accountActivated: user.isActive
  });
  return { user: { id: user.id, name: user.name, email: user.email, isActive: user.isActive, emailVerifiedAt: user.emailVerifiedAt }, profile };
}

export async function setDistributorActive(req) {
  const { isActive } = req.body;
  if (typeof isActive !== "boolean") throw Object.assign(new Error("isActive must be a boolean"), { status: 400 });
  const user = await User.findOne({ _id: req.params.id, role: "DISTRIBUTOR" });
  if (!user) throw Object.assign(new Error("Distributor not found"), { status: 404 });
  const profile = await DistributorProfile.findOne({ user: user._id });
  if (isActive && (!profile || profile.approvalStatus !== "APPROVED" || !user.emailVerifiedAt)) {
    throw Object.assign(new Error("Only approved and email-verified distributors can be activated"), { status: 409 });
  }
  user.isActive = isActive;
  await user.save();
  await recordAudit(req, isActive ? "DISTRIBUTOR_ACTIVATED" : "DISTRIBUTOR_DEACTIVATED", "User", user._id);
  return { id: user.id, isActive: user.isActive };
}
