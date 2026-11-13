import multer from "multer";
const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter(_req, file, cb) {
    if (!allowed.has(file.mimetype)) return cb(new Error("Only JPG, PNG, WEBP and AVIF images are allowed"));
    cb(null, true);
  }
});
export default uploadImage;
