import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { adminIpFilter } from "../middleware/adminIpFilter.js";
import uploadDocument from "../middleware/uploadDocument.js";
import {
  listPublic,
  download,
  submitInquiry,
  adminList,
  upload,
  reset
} from "../controllers/document.controller.js";

const publicRouter = Router();
const adminRouter = Router();

// Public Routes
publicRouter.get("/public", listPublic);
publicRouter.get("/download/:key", download);
publicRouter.post("/partnership-inquiry", submitInquiry);

// Admin Protected Routes
adminRouter.use(adminIpFilter, authenticate, authorize("ADMIN", "SUPER_ADMIN"));
adminRouter.get("/", adminList);
adminRouter.post("/upload/:key", uploadDocument.single("file"), upload);
adminRouter.delete("/:key", reset);

export { publicRouter as publicDocumentRoutes, adminRouter as adminDocumentRoutes };
