import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";

import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import distributorRoutes from "./routes/distributor.routes.js";
import { distributorOrderRoutes, adminOrderRoutes } from "./routes/order.routes.js";
import { paymentWebhookRoutes, distributorPaymentRoutes, adminPaymentRoutes } from "./routes/payment.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import { publicJobRoutes, hrJobRoutes } from "./routes/job.routes.js";
import { publicApplicationRoutes, hrApplicationRoutes } from "./routes/application.routes.js";
import interviewRoutes from "./routes/interview.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import { adminShipmentRoutes, distributorShipmentRoutes } from "./routes/shipment.routes.js";
import { publicDocumentRoutes, adminDocumentRoutes } from "./routes/document.routes.js";
import { adminIpFilter } from "./middleware/adminIpFilter.js";
import userManagementRoutes from "./routes/userManagement.routes.js";
import uploadRoutes from "./routes/upload.routes.js";

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGINS || "")
  .split(",").map((origin) => origin.trim()).filter(Boolean);

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true
}));

// Webhook endpoint requires raw body for HMAC signature verification
app.use("/api/webhooks", express.raw({ type: "application/json", limit: "1mb" }), paymentWebhookRoutes);
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 150, standardHeaders: "draft-7", legacyHeaders: false }));

app.get("/api/health", (_req, res) => res.json({ success: true, message: "Indira API is running" }));
app.use("/uploads", express.static(path.resolve("uploads")));

// Global admin IP security filter
app.use("/api/admin", adminIpFilter);

// Route Modules
app.use("/api/auth", authRoutes);
app.use("/api/documents", publicDocumentRoutes);
app.use("/api/admin/documents", adminDocumentRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/admin/inventory", inventoryRoutes);
app.use("/api/admin/distributors", distributorRoutes);
app.use("/api/distributor/orders", distributorOrderRoutes);
app.use("/api/admin/orders", adminOrderRoutes);
app.use("/api/distributor/payments", distributorPaymentRoutes);
app.use("/api/admin/payments", adminPaymentRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/admin/analytics", analyticsRoutes);
app.use("/api/jobs", publicJobRoutes);
app.use("/api/hr/jobs", hrJobRoutes);
app.use("/api/applications", rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false }), publicApplicationRoutes);
app.use("/api/hr/applications", hrApplicationRoutes);
app.use("/api/hr/interviews", interviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin/security", auditRoutes);
app.use("/api/admin/shipments", adminShipmentRoutes);
app.use("/api/distributor/shipments", distributorShipmentRoutes);
app.use("/api/admin/users", userManagementRoutes);
app.use("/api/upload", uploadRoutes);

// Global Error Handler
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";

import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import distributorRoutes from "./routes/distributor.routes.js";
import {
  distributorOrderRoutes,
  adminOrderRoutes
} from "./routes/order.routes.js";
import {
  paymentWebhookRoutes,
  distributorPaymentRoutes,
  adminPaymentRoutes
} from "./routes/payment.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import {
  publicJobRoutes,
  hrJobRoutes
} from "./routes/job.routes.js";
import {
  publicApplicationRoutes,
  hrApplicationRoutes
} from "./routes/application.routes.js";
import interviewRoutes from "./routes/interview.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import {
  adminShipmentRoutes,
  distributorShipmentRoutes
} from "./routes/shipment.routes.js";
import {
  publicDocumentRoutes,
  adminDocumentRoutes
} from "./routes/document.routes.js";
import { adminIpFilter } from "./middleware/adminIpFilter.js";
import userManagementRoutes from "./routes/userManagement.routes.js";
import uploadRoutes from "./routes/upload.routes.js";

const app = express();

// Allowed frontend origins
const allowedOrigins = (process.env.CLIENT_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Security
app.disable("x-powered-by");

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.error("Blocked CORS origin:", origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

// CORS must execute before API routes and rate limiting
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Helmet security headers
app.use(helmet());

// Webhook endpoint requires raw body for HMAC signature verification
app.use(
  "/api/webhooks",
  express.raw({
    type: "application/json",
    limit: "1mb"
  }),
  paymentWebhookRoutes
);

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 150,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Indira API is running"
  });
});

// Static uploads
app.use("/uploads", express.static(path.resolve("uploads")));

// Global admin IP security filter
app.use("/api/admin", adminIpFilter);

// Route Modules
app.use("/api/auth", authRoutes);
app.use("/api/documents", publicDocumentRoutes);
app.use("/api/admin/documents", adminDocumentRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/admin/inventory", inventoryRoutes);
app.use("/api/admin/distributors", distributorRoutes);

app.use("/api/distributor/orders", distributorOrderRoutes);
app.use("/api/admin/orders", adminOrderRoutes);

app.use("/api/distributor/payments", distributorPaymentRoutes);
app.use("/api/admin/payments", adminPaymentRoutes);

app.use("/api/invoices", invoiceRoutes);
app.use("/api/admin/analytics", analyticsRoutes);

app.use("/api/jobs", publicJobRoutes);
app.use("/api/hr/jobs", hrJobRoutes);

app.use(
  "/api/applications",
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false
  }),
  publicApplicationRoutes
);

app.use("/api/hr/applications", hrApplicationRoutes);
app.use("/api/hr/interviews", interviewRoutes);

app.use("/api/notifications", notificationRoutes);
app.use("/api/admin/security", auditRoutes);

app.use("/api/admin/shipments", adminShipmentRoutes);
app.use("/api/distributor/shipments", distributorShipmentRoutes);

app.use("/api/admin/users", userManagementRoutes);
app.use("/api/upload", uploadRoutes);

// Global Error Handler
app.use((err, _req, res, _next) => {
  console.error(err);

  if (
    err.name === "ValidationError" ||
    err.name === "CastError"
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid request data"
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : err.message
  });
});

export default app;

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.name === "ValidationError" || err.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid request data" });
  }
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Something went wrong" : err.message
  });
});

export default app;
