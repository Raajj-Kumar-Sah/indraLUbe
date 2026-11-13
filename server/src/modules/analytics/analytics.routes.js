import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { dashboard, exportReport, exportExcelReport } from "./analytics.service.js";

const router = Router();
router.use(authenticate, authorize("ADMIN", "SUPER_ADMIN"));

router.get("/dashboard", async (req, res, next) => {
  try {
    res.json({ success: true, data: await dashboard(req.query) });
  } catch (e) {
    next(e);
  }
});

router.get("/exports/:kind/excel", async (req, res, next) => {
  try {
    const permitted = ["orders", "payments", "sales", "inventory", "distributors", "stock-movements"];
    if (!permitted.includes(req.params.kind)) {
      return res.status(404).json({ success: false, message: "Unknown report" });
    }
    const buffer = await exportExcelReport(req.params.kind, req.query);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="indira-${req.params.kind}-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

router.get("/exports/:kind", async (req, res, next) => {
  try {
    const format = req.query.format || "csv";
    const permitted = ["orders", "payments", "sales", "inventory", "distributors", "stock-movements"];
    if (!permitted.includes(req.params.kind)) {
      return res.status(404).json({ success: false, message: "Unknown report" });
    }

    if (format === "xlsx" || format === "excel") {
      const buffer = await exportExcelReport(req.params.kind, req.query);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="indira-${req.params.kind}-${new Date().toISOString().slice(0, 10)}.xlsx"`);
      res.setHeader("Cache-Control", "no-store");
      return res.send(buffer);
    }

    const content = await exportReport(req.params.kind, req.query);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="indira-${req.params.kind}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.setHeader("Cache-Control", "no-store");
    res.send("\uFEFF" + content);
  } catch (e) {
    next(e);
  }
});

export default router;
