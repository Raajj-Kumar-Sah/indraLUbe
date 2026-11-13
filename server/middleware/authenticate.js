import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      issuer: process.env.JWT_ISSUER || "indira-api",
      audience: process.env.JWT_AUDIENCE || "indira-client"
    });
    const account = await User.findById(req.user.sub).select(
      "role isActive emailVerifiedAt passwordChangedAt blockedAt suspendedUntil"
    );
    if (
      !account ||
      !account.emailVerifiedAt ||
      account.role !== req.user.role ||
      (account.passwordChangedAt && req.user.iat * 1000 < account.passwordChangedAt.getTime()) ||
      account.blockedAt ||
      (account.suspendedUntil && account.suspendedUntil > new Date()) ||
      !account.isActive
    ) {
      return res.status(401).json({ success: false, message: "Account is no longer authorized" });
    }
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired access token" });
  }
}
