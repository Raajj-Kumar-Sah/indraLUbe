import multer from "multer";

const allowed = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 35 * 1024 * 1024 }, // 35 MB
  fileFilter(_req, file, cb) {
    if (
      allowed.has(file.mimetype) ||
      file.originalname.match(/\.(pdf|doc|docx|xls|xlsx|zip|png|jpg|jpeg)$/i)
    ) {
      return cb(null, true);
    }
    cb(new Error("Allowed formats: PDF, DOC, DOCX, XLS, XLSX, ZIP, PNG, JPG (up to 35MB)"));
  }
});

export default uploadDocument;
