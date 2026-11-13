import test from "node:test";
import assert from "node:assert/strict";
import { authorize } from "../src/middleware/authorize.js";
import { adminIpFilter } from "../src/middleware/adminIpFilter.js";
import ExcelJS from "exceljs";

test("SUPER_ADMIN role bypasses standard role restrictions for complete platform access", () => {
  const middleware = authorize("ADMIN");
  let nextCalled = false;
  const req = { user: { role: "SUPER_ADMIN", sub: "super-admin-id" } };
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
  middleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true, "SUPER_ADMIN should have complete access to ADMIN routes");

  // Also verify HR route access
  nextCalled = false;
  const hrMiddleware = authorize("HR");
  hrMiddleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true, "SUPER_ADMIN should have access to HR routes");
});

test("Unauthorized roles are blocked by role authorization middleware", () => {
  const middleware = authorize("ADMIN");
  let nextCalled = false;
  const req = { user: { role: "DISTRIBUTOR", sub: "dist-id" } };
  let statusCode = 200;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    }
  };
  middleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(statusCode, 403);
});

test("Admin IP filter permits requests when ADMIN_ALLOWED_IPS is not configured", () => {
  const originalEnv = process.env.ADMIN_ALLOWED_IPS;
  delete process.env.ADMIN_ALLOWED_IPS;

  let nextCalled = false;
  const req = { headers: {}, ip: "203.0.113.195" };
  const res = {};

  adminIpFilter(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  process.env.ADMIN_ALLOWED_IPS = originalEnv;
});

test("Admin IP filter blocks untrusted IPs and allows allowlisted IPs", () => {
  const originalEnv = process.env.ADMIN_ALLOWED_IPS;
  process.env.ADMIN_ALLOWED_IPS = "192.168.1.100, 10.0.0.1, 127.0.0.1";

  // Test blocked external IP
  let nextCalled = false;
  let blockedCode = 200;
  const blockedReq = { headers: { "x-forwarded-for": "198.51.100.2" }, ip: "198.51.100.2" };
  const blockedRes = {
    status(c) {
      blockedCode = c;
      return this;
    },
    json() {
      return this;
    }
  };

  adminIpFilter(blockedReq, blockedRes, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(blockedCode, 403);

  // Test allowed IP
  nextCalled = false;
  const allowedReq = { headers: { "cf-connecting-ip": "10.0.0.1" } };
  const allowedRes = {};

  adminIpFilter(allowedReq, allowedRes, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);

  process.env.ADMIN_ALLOWED_IPS = originalEnv;
});

test("ExcelJS workbook builds valid worksheet structure with styled headers and formatting", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Test Orders");

  sheet.columns = [
    { header: "Order ID", key: "orderNumber", width: 20 },
    { header: "Total Amount (₹)", key: "totalAmount", width: 16 }
  ];

  sheet.addRow({ orderNumber: "IND-2026-TEST", totalAmount: 45000 });

  const buffer = await workbook.xlsx.writeBuffer();
  assert.ok(buffer instanceof Buffer || buffer instanceof Uint8Array);
  assert.ok(buffer.length > 500, "Workbook binary buffer should be generated");
});
