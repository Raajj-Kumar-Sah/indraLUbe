import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { getDashboard, exportExcel, exportData } from "../controllers/analytics.controller.js";

const router = Router();
router.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));

router.get("/dashboard", getDashboard);
router.get("/exports/:kind/excel", exportExcel);
router.get("/exports/:kind", exportData);

export default router;
