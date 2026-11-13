import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { mine, markRead, markAllRead } from "../controllers/notification.controller.js";

const router = Router();
router.use(authenticate);

router.get("/", mine);
router.patch("/:id/read", markRead);
router.post("/read-all", markAllRead);

export default router;
