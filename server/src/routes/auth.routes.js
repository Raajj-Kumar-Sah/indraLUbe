import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  login,
  googleLogin,
  register,
  refresh,
  logout,
  forgotPassword,
  reset,
  verify
} from "../controllers/auth.controller.js";

const router = Router();
const sensitiveLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again later." }
});

router.post("/login", sensitiveLimit, login);
router.post("/register", sensitiveLimit, register);
router.post("/register-distributor", sensitiveLimit, register);
router.post("/refresh", sensitiveLimit, refresh);
router.post("/logout", logout);
router.post("/google", sensitiveLimit, googleLogin);
router.post("/forgot-password", sensitiveLimit, forgotPassword);
router.post("/reset-password", sensitiveLimit, reset);
router.post("/verify-email", sensitiveLimit, verify);

export default router;
