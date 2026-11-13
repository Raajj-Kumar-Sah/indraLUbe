import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import User from "./user.model.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function createAccessToken(user) {
  if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32) {
    throw new Error("JWT_ACCESS_SECRET must be configured with at least 32 characters");
  }

  return jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: "15m",
      issuer: process.env.JWT_ISSUER || "indira-api",
      audience: process.env.JWT_AUDIENCE || "indira-client"
    }
  );
}

export async function loginWithGoogle(credential) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    const error = new Error("Google account email must be verified");
    error.status = 401;
    throw error;
  }

  const email = payload.email.toLowerCase().trim();
  let user = await User.findOne({ googleId: payload.sub }).select("+googleId");

  if (!user) {
    user = await User.findOne({ email }).select("+googleId +passwordHash");

    if (user) {
      // Link Google only to an already verified, pre-existing account.
      if (!user.emailVerifiedAt) {
        const error = new Error("Verify your existing email account before linking Google sign-in");
        error.status = 409;
        throw error;
      }
      user.googleId = payload.sub;
      user.authProvider = user.passwordHash ? "LOCAL_AND_GOOGLE" : "GOOGLE";
      await user.save();
    } else {
      // Public Google sign-ups are distributor applicants only, never privileged staff.
      user = await User.create({
        name: payload.name || email.split("@")[0],
        email,
        googleId: payload.sub,
        authProvider: "GOOGLE",
        role: "DISTRIBUTOR",
        isActive: false,
        emailVerifiedAt: new Date()
      });

      return {
        pendingApproval: true,
        message: "Google account verified. Your distributor access is pending company approval."
      };
    }
  }

  if (!user.isActive) {
    return {
      pendingApproval: true,
      message: "Your account is awaiting company approval."
    };
  }

  const accessToken = createAccessToken(user);
  return {
    pendingApproval: false,
    accessToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  };
}
