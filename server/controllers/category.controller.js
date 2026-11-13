import * as service from "../services/category.service.js";

export async function list(req, res, next) {
  try {
    res.json({ success: true, data: await service.listCategories(req.query) });
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    res.status(201).json({ success: true, data: await service.createCategory(req) });
  } catch (e) {
    next(e);
  }
}

export async function update(req, res, next) {
  try {
    res.json({ success: true, data: await service.updateCategory(req) });
  } catch (e) {
    next(e);
  }
}
