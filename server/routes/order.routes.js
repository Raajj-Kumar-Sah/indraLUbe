import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import * as controller from "../controllers/order.controller.js";

export const distributorOrderRoutes = Router();
distributorOrderRoutes.use(authenticate, authorize("DISTRIBUTOR"));
distributorOrderRoutes.post("/", controller.create);
distributorOrderRoutes.get("/", controller.mine);
distributorOrderRoutes.get("/:id", controller.mineDetail);

export const adminOrderRoutes = Router();
adminOrderRoutes.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));
adminOrderRoutes.get("/", controller.adminList);
adminOrderRoutes.get("/:id", controller.adminDetail);
adminOrderRoutes.patch("/:id/status", controller.status);
adminOrderRoutes.patch("/:id/shipment", controller.shipment);
