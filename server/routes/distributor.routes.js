import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import * as controller from "../controllers/distributor.controller.js";

const router = Router();

router.use(authenticate, authorize("SUPER_ADMIN", "ADMIN"));
router.get("/", controller.list);
router.get("/:id", controller.detail);
router.patch("/:id/profile", controller.updateProfile);
router.patch("/:id/approval", controller.status);
router.patch("/:id/active", controller.active);

export default router;
