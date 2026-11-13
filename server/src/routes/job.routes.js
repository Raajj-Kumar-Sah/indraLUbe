import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import {
  publicList,
  publicDetail,
  hrList,
  hrCreate,
  hrUpdate
} from "../controllers/job.controller.js";

const publicRouter = Router();
const hrRouter = Router();

publicRouter.get("/", publicList);
publicRouter.get("/:id", publicDetail);

hrRouter.use(authenticate, authorize("HR", "ADMIN", "SUPER_ADMIN"));
hrRouter.get("/", hrList);
hrRouter.post("/", hrCreate);
hrRouter.patch("/:id", hrUpdate);

export { publicRouter as publicJobRoutes, hrRouter as hrJobRoutes };
