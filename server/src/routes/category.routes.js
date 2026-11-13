import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import * as controller from "../controllers/category.controller.js";

const router = Router();

router.get("/", controller.list);
router.use(authenticate, authorize("SUPER_ADMIN", "ADMIN"));
router.post("/", controller.create);
router.patch("/:id", controller.update);

export default router;
