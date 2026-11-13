import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import uploadImage from "../middleware/uploadImage.js";
import { adminIpFilter } from "../middleware/adminIpFilter.js";
import * as controller from "../controllers/product.controller.js";

const router = Router();

router.get("/", controller.publicList);
router.get("/slug/:slug", controller.publicDetail);

router.use(adminIpFilter, authenticate, authorize("SUPER_ADMIN", "ADMIN"));
router.get("/admin", controller.list);
router.post("/", controller.create);
router.patch("/:id", controller.update);
router.patch("/:id/active", controller.active);
router.post("/:id/images", uploadImage.array("images", 6), controller.images);
router.delete("/:id/images/:imageId", controller.removeImage);
router.delete("/:id", controller.remove);

export default router;
