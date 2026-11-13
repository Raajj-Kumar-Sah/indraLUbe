import * as service from "../services/product.service.js";

const ok = (res, data, message = "Success", status = 200) =>
  res.status(status).json({ success: true, message, data });

export async function list(req, res, next) {
  try {
    ok(res, await service.listProducts(req.query));
  } catch (e) {
    next(e);
  }
}

export async function publicList(req, res, next) {
  try {
    ok(res, await service.listProducts({ ...req.query, status: "active" }));
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    ok(res, await service.createProduct(req), "Product created", 201);
  } catch (e) {
    next(e);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await service.updateProduct(req), "Product updated");
  } catch (e) {
    next(e);
  }
}

export async function active(req, res, next) {
  try {
    ok(res, await service.setProductActive(req), "Product status updated");
  } catch (e) {
    next(e);
  }
}

export async function images(req, res, next) {
  try {
    ok(res, await service.addProductImages(req), "Images uploaded", 201);
  } catch (e) {
    next(e);
  }
}

export async function removeImage(req, res, next) {
  try {
    ok(res, await service.removeProductImage(req), "Image removed");
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    await service.deleteProduct(req);
    ok(res, null, "Product deleted");
  } catch (e) {
    next(e);
  }
}

export async function publicDetail(req, res, next) {
  try {
    ok(res, await service.getPublicProductBySlug(req.params.slug));
  } catch (e) {
    next(e);
  }
}
