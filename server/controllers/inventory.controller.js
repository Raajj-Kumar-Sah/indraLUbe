import * as service from "../services/inventory.service.js";

export async function list(req, res, next) {
  try {
    res.json({ success: true, data: await service.getInventory(req.query) });
  } catch (e) {
    next(e);
  }
}

export async function adjust(req, res, next) {
  try {
    res.json({ success: true, message: "Stock movement recorded", data: await service.adjustStock(req) });
  } catch (e) {
    next(e);
  }
}

export async function movements(req, res, next) {
  try {
    res.json({ success: true, data: await service.getMovements(req) });
  } catch (e) {
    next(e);
  }
}
