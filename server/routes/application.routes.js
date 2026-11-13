import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import {
  submit,
  hrList,
  hrUpdateStage
} from "../controllers/application.controller.js";

const publicRouter = Router();
const hrRouter = Router();

publicRouter.post("/", submit);

hrRouter.use(authenticate, authorize("HR", "ADMIN", "SUPER_ADMIN"));
hrRouter.get("/", hrList);
hrRouter.patch("/:id/stage", hrUpdateStage);

export { publicRouter as publicApplicationRoutes, hrRouter as hrApplicationRoutes };
