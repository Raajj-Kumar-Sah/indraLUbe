import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import * as controller from "../controllers/inventory.controller.js";

const router = Router();

router.use(authenticate, authorize("SUPER_ADMIN", "ADMIN"));
router.get("/", controller.list);
router.get("/movements", controller.movements);
router.post("/:id/movements", controller.adjust);

export default router;
