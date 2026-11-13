import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { adminIpFilter } from "../../middleware/adminIpFilter.js";
import uploadDocument from "../../middleware/uploadDocument.js";
import {
  listAllDocuments,
  uploadDocumentFile,
  downloadDocument,
  resetDocument,
  submitPartnershipInquiry,
  listPartnershipInquiries
} from "./document.service.js";

const publicRouter = Router();
const adminRouter = Router();

// Public Routes
publicRouter.get("/public", async (_req, res, next) => {
  try {
    const docs = await listAllDocuments();
    res.json({ success: true, data: docs });
  } catch (e) {
    next(e);
  }
});

publicRouter.get("/download/:key", async (req, res, next) => {
  try {
    await downloadDocument(req.params.key, res);
  } catch (e) {
    next(e);
  }
});

publicRouter.post("/partnership-inquiry", async (req, res, next) => {
  try {
    const result = await submitPartnershipInquiry(req.body);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

// Admin Protected Routes
adminRouter.use(adminIpFilter, authenticate, authorize("ADMIN", "SUPER_ADMIN"));

adminRouter.get("/", async (_req, res, next) => {
  try {
    const [documents, inquiries] = await Promise.all([
      listAllDocuments(),
      listPartnershipInquiries()
    ]);
    res.json({ success: true, data: { documents, inquiries } });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/upload/:key", uploadDocument.single("file"), async (req, res, next) => {
  try {
    const doc = await uploadDocumentFile(req.params.key, req.file, req.body, req.user);
    res.status(201).json({
      success: true,
      message: `Document '${doc.title}' updated successfully via Cloudinary/Storage.`,
      data: doc
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.delete("/:key", async (req, res, next) => {
  try {
    const result = await resetDocument(req.params.key);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export { publicRouter as publicDocumentRoutes, adminRouter as adminDocumentRoutes };
