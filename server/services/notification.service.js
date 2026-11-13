import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";
import { sendTransactionalEmail } from "./email.js";

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function notifyUser({ recipient, type = "SYSTEM", title, message, link = "", entityType = "", entityId = "", email = false }) {
  const user = await User.findById(recipient).select("email isActive");
  if (!user || !user.isActive) return null;
  const doc = await Notification.create({ recipient, type, title, message, link, entityType, entityId, emailStatus: email ? "PENDING" : "NOT_REQUESTED" });
  if (email) {
    try {
      await sendTransactionalEmail({
        to: user.email,
        subject: title,
        htmlText: `<p>${escapeHtml(message)}</p>${link ? `<p><a href="${escapeHtml(link)}">Open workspace</a></p>` : ""}`,
        textContent: message
      });
      doc.emailStatus = "SENT";
    } catch {
      doc.emailStatus = "FAILED";
    }
    await doc.save();
  }
  return doc;
}

export async function notifyRoles(roles, payload) {
  const users = await User.find({ role: { $in: roles }, isActive: true }).select("_id");
  return Promise.all(users.map(u => notifyUser({ ...payload, recipient: u._id })));
}

export async function listMine(userId, { unreadOnly = false, page = 1, limit = 30 } = {}) {
  const filter = { recipient: userId };
  if (unreadOnly) filter.readAt = null;
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(50, Math.max(1, Number(limit) || 30));
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: userId, readAt: null })
  ]);
  return { items, total, unread, page: p, limit: l };
}
