import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import {
  listAuditLogs,
  listAuthEvents,
  listUsers,
  updateUserAccess,
  updateUserRole
} from "../controllers/audit.controller.js";

const router = Router();
router.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));

router.get("/", listAuditLogs);
router.get("/auth-events", listAuthEvents);
router.get("/users", listUsers);
router.patch("/users/:id/access", authorize("SUPER_ADMIN"), updateUserAccess);
router.patch("/users/:id/role", authorize("SUPER_ADMIN"), updateUserRole);

export default router;
