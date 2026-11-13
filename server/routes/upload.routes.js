/**
 * upload.routes.js
 * Public / semi-public Cloudinary upload endpoints.
 *
 * POST /api/upload/resume
 *   - Accepts PDF, DOC, DOCX (up to 10 MB)
 *   - Uploads to Cloudinary folder: indira-industries/resumes/
 *   - Returns { url, publicId, fileName }
 *
 * POST /api/upload/image  (admin only)
 *   - Accepts JPG, PNG, WEBP, AVIF (up to 5 MB)
 *   - Uploads to Cloudinary folder: indira-industries/misc/
 *   - Returns { url, publicId }
 */
import { Router } from "express";
import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import rateLimit from "express-rate-limit";

const router = Router();

/* ── Multer configs ─────────────────────────────────── */
const resumeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const imageTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "image/avif"
]);

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    if (resumeTypes.has(file.mimetype) || /\.(pdf|doc|docx)$/i.test(file.originalname)) {
      return cb(null, true);
    }
    cb(new Error("Only PDF, DOC, and DOCX files are accepted for resumes (max 10 MB)."));
  }
});

const miscImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    if (imageTypes.has(file.mimetype)) return cb(null, true);
    cb(new Error("Only JPG, PNG, WEBP, and AVIF images are accepted (max 5 MB)."));
  }
});

/* ── Cloudinary upload helper ───────────────────────── */
function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

/* ── Rate limit for public resume uploads ─────────────
   Max 5 resume uploads per IP per hour to prevent abuse */
const resumeRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many file uploads. Please try again later." }
});

/* ─────────────────────────────────────────────────────
   POST /api/upload/resume
   Public endpoint — called from Careers page before
   the application form is submitted.
───────────────────────────────────────────────────── */
router.post(
  "/resume",
  resumeRateLimit,
  resumeUpload.single("resume"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file received." });
      }

      const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const publicId = `resume_${Date.now()}_${safeName.replace(/\.[^.]+$/, "")}`;

      const result = await uploadToCloudinary(req.file.buffer, {
        folder: "indira-industries/resumes",
        public_id: publicId,
        resource_type: "raw",   // PDFs and docs must use "raw"
        access_mode: "public",
        tags: ["resume", "career-application"]
      });

      return res.status(201).json({
        success: true,
        data: {
          url: result.secure_url,
          publicId: result.public_id,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          format: result.format || "pdf"
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ─────────────────────────────────────────────────────
   POST /api/upload/image  (Admin / Super Admin only)
   For miscellaneous admin image uploads (e.g. logos,
   banners) beyond the product image pipeline.
───────────────────────────────────────────────────── */
router.post(
  "/image",
  authenticate,
  authorize("ADMIN", "SUPER_ADMIN"),
  miscImageUpload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No image received." });
      }

      const result = await uploadToCloudinary(req.file.buffer, {
        folder: "indira-industries/misc",
        resource_type: "image",
        tags: ["admin-upload"]
      });

      return res.status(201).json({
        success: true,
        data: {
          url: result.secure_url,
          publicId: result.public_id
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
