import AuditLog from "../models/auditLog.model.js";

export async function recordAudit(req, action, entityType, entityId = "", details = {}) {
  try {
    await AuditLog.create({
      actor: req.user.sub,
      action,
      entityType,
      entityId: String(entityId || ""),
      details,
      ip: req.ip
    });
  } catch (error) {
    console.error("Audit log write failed:", error.message);
    throw new Error("The operation could not be safely audited");
  }
}
