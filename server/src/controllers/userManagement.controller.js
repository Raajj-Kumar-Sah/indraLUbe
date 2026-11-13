/**
 * userManagement.controller.js
 * Super Admin user management: list, create, block, suspend, remove, set password.
 * All routes require SUPER_ADMIN role.
 */
import {
  listUsers,
  createManagedUser,
  updateUserStatus,
  setUserPassword,
  deleteUser
} from "../services/userManagement.service.js";

/** GET /api/admin/users?role=&status=&search=&page=&limit= */
export async function getUsers(req, res, next) {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const result = await listUsers({ role, status, search, page: Number(page), limit: Number(limit) });
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
}

/** POST /api/admin/users  – create HR / ADMIN staff account */
export async function createUser(req, res, next) {
  try {
    const user = await createManagedUser(req.body, req.user.sub);
    res.status(201).json({ success: true, message: "User account created successfully.", data: user });
  } catch (e) {
    next(e);
  }
}

/** PATCH /api/admin/users/:id/status  – body: { action: "BLOCK"|"SUSPEND"|"ACTIVATE" } */
export async function patchUserStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { action } = req.body;
    if (!["BLOCK", "SUSPEND", "ACTIVATE"].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be BLOCK, SUSPEND, or ACTIVATE" });
    }
    // Super admin cannot block themselves
    if (String(id) === String(req.user.sub)) {
      return res.status(400).json({ success: false, message: "You cannot change your own account status." });
    }
    const user = await updateUserStatus(id, action, req.user.sub);
    res.json({ success: true, message: `User ${action.toLowerCase()}ed successfully.`, data: user });
  } catch (e) {
    next(e);
  }
}

/** PATCH /api/admin/users/:id/password  – body: { password } */
export async function patchUserPassword(req, res, next) {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }
    await setUserPassword(id, password, req.user.sub);
    res.json({ success: true, message: "Password updated successfully. The user can now log in with the new password." });
  } catch (e) {
    next(e);
  }
}

/** DELETE /api/admin/users/:id */
export async function removeUser(req, res, next) {
  try {
    const { id } = req.params;
    if (String(id) === String(req.user.sub)) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account." });
    }
    await deleteUser(id, req.user.sub);
    res.json({ success: true, message: "User account permanently removed." });
  } catch (e) {
    next(e);
  }
}
