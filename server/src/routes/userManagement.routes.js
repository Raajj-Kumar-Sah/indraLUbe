/**
 * userManagement.routes.js
 * Routes for Super Admin user management (SUPER_ADMIN role required).
 */
import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import {
  getUsers,
  createUser,
  patchUserStatus,
  patchUserPassword,
  removeUser
} from "../controllers/userManagement.controller.js";

const router = Router();

// All routes require authentication + SUPER_ADMIN role
router.use(authenticate, authorize("SUPER_ADMIN"));

router.get("/", getUsers);
router.post("/", createUser);
router.patch("/:id/status", patchUserStatus);
router.patch("/:id/password", patchUserPassword);
router.delete("/:id", removeUser);

export default router;
