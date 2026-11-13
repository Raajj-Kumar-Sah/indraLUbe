import {
  loginWithPassword,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  registerDistributor,
  rotateRefreshToken,
  revokeRefreshToken
} from "../services/auth.service.js";
import { loginWithGoogle } from "../services/google.service.js";

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }
    res.json({ success: true, data: await loginWithPassword(email, password, req) });
  } catch (e) {
    next(e);
  }
}

export async function register(req, res, next) {
  try {
    const result = await registerDistributor(req.body, req);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ success: false, message: "Refresh token is required" });
    const result = await rotateRefreshToken(refreshToken, req);
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body || {};
    if (refreshToken) await revokeRefreshToken(refreshToken);
    res.json({ success: true, message: "Logged out successfully" });
  } catch (e) {
    next(e);
  }
}

export async function googleLogin(req, res, next) {
  try {
    const { credential } = req.body || {};
    if (typeof credential !== "string" || !credential.trim()) {
      return res.status(400).json({ success: false, message: "Google credential is required" });
    }
    const result = await loginWithGoogle(credential);
    res.status(result.pendingApproval ? 202 : 200).json({ success: true, data: result });
  } catch (e) {
    if (!e.status) e.status = 401;
    next(e);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body || {};
    if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: "A valid email is required" });
    }
    await requestPasswordReset(email, req);
    res.json({ success: true, message: "If an active account exists, password reset instructions will be sent." });
  } catch (e) {
    next(e);
  }
}

export async function reset(req, res, next) {
  try {
    const { token, password } = req.body || {};
    if (typeof password !== "string" || password.length < 8 || password.length > 72) {
      return res.status(400).json({ success: false, message: "Password must be 8–72 characters" });
    }
    await resetPassword(token, password, req);
    res.json({ success: true, message: "Password reset successfully. Please sign in again." });
  } catch (e) {
    next(e);
  }
}

export async function verify(req, res, next) {
  try {
    await verifyEmail(req.body?.token, req);
    res.json({ success: true, message: "Email verified successfully." });
  } catch (e) {
    next(e);
  }
}
