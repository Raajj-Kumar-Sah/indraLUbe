import mongoose from "mongoose";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import StockMovement from "../models/stockMovement.model.js";
import cloudinary from "../config/cloudinary.js";
import { recordAudit } from "./audit.js";

const divisions = ["IINDLUBE", "IINDPURE", "IINDSTYL", "Corporate"];
const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function validateProduct(body) {
  const required = ["sku", "name", "division", "category", "brand"];
  for (const key of required) if (!String(body[key] || "").trim()) throw Object.assign(new Error(`${key} is required`), { status: 400 });
  if (!divisions.includes(body.division)) throw Object.assign(new Error("Invalid division"), { status: 400 });
  for (const key of ["price", "stockQuantity", "reorderLevel"]) {
    if (body[key] !== undefined && (!Number.isFinite(Number(body[key])) || Number(body[key]) < 0)) {
      throw Object.assign(new Error(`${key} must be a non-negative number`), { status: 400 });
    }
  }
}

async function uploadBuffer(file, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "image" }, (error, result) => {
      if (error) reject(error); else resolve({ publicId: result.public_id, url: result.secure_url });
    });
    stream.end(file.buffer);
  });
}
async function removeCloudImage(publicId) {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
}

export async function listProducts(query = {}) {
  const filter = {};
  if (query.division && divisions.includes(query.division)) filter.division = query.division;
  if (query.status === "active") filter.isActive = true;
  if (query.status === "inactive") filter.isActive = false;
  if (query.category && mongoose.isValidObjectId(query.category)) filter.category = query.category;
  if (query.search) filter.$text = { $search: String(query.search).slice(0, 100) };
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const [items, total] = await Promise.all([
    Product.find(filter).populate("category", "name division").sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter)
  ]);
  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function createProduct(req) {
  validateProduct(req.body);
  const category = await Category.findOne({ _id: req.body.category, division: req.body.division, isActive: true });
  if (!category) throw Object.assign(new Error("Select an active category belonging to this division"), { status: 400 });
  const initialStock = Number(req.body.stockQuantity || 0);
  const product = await Product.create({
    ...req.body, slug: `${slugify(req.body.name)}-${slugify(req.body.sku)}`,
    price: Number(req.body.price), distributorPrice: req.body.distributorPrice === "" ? null : Number(req.body.distributorPrice),
    stockQuantity: 0, reorderLevel: Number(req.body.reorderLevel || 10),
    specifications: Array.isArray(req.body.specifications) ? req.body.specifications : [],
    createdBy: req.user.sub, updatedBy: req.user.sub
  });
  if (initialStock > 0) {
    product.stockQuantity = initialStock;
    await product.save();
    await StockMovement.create({ product: product._id, type: "OPENING", quantity: initialStock, previousQuantity: 0, newQuantity: initialStock, reason: "Opening stock at product creation", performedBy: req.user.sub });
  }
  await recordAudit(req, "PRODUCT_CREATED", "Product", product._id, { sku: product.sku, name: product.name });
  return product.populate("category", "name division");
}

export async function updateProduct(req) {
  validateProduct(req.body);
  const product = await Product.findById(req.params.id);
  if (!product) throw Object.assign(new Error("Product not found"), { status: 404 });
  const category = await Category.findOne({ _id: req.body.category, division: req.body.division, isActive: true });
  if (!category) throw Object.assign(new Error("Select an active category belonging to this division"), { status: 400 });
  const allowed = ["sku","name","division","category","brand","shortDescription","description","specifications","price","distributorPrice","reorderLevel","isActive"];
  for (const key of allowed) if (req.body[key] !== undefined) product[key] = req.body[key];
  product.slug = `${slugify(product.name)}-${slugify(product.sku)}`;
  product.price = Number(product.price);
  if (product.distributorPrice !== null && product.distributorPrice !== undefined) product.distributorPrice = Number(product.distributorPrice);
  product.reorderLevel = Number(product.reorderLevel);
  product.updatedBy = req.user.sub;
  await product.save();
  await recordAudit(req, "PRODUCT_UPDATED", "Product", product._id, { sku: product.sku });
  return product.populate("category", "name division");
}

export async function setProductActive(req) {
  const product = await Product.findById(req.params.id);
  if (!product) throw Object.assign(new Error("Product not found"), { status: 404 });
  product.isActive = Boolean(req.body.isActive);
  product.updatedBy = req.user.sub;
  await product.save();
  await recordAudit(req, product.isActive ? "PRODUCT_ACTIVATED" : "PRODUCT_DEACTIVATED", "Product", product._id);
  return product;
}

export async function addProductImages(req) {
  const product = await Product.findById(req.params.id);
  if (!product) throw Object.assign(new Error("Product not found"), { status: 404 });
  if (!req.files?.length) throw Object.assign(new Error("Choose at least one image"), { status: 400 });
  const uploaded = [];
  try {
    for (const file of req.files) uploaded.push(await uploadBuffer(file, `indira-industries/products/${product.sku}`));
    product.images.push(...uploaded);
    product.updatedBy = req.user.sub;
    await product.save();
  } catch (error) {
    await Promise.allSettled(uploaded.map((img) => removeCloudImage(img.publicId)));
    throw error;
  }
  await recordAudit(req, "PRODUCT_IMAGES_ADDED", "Product", product._id, { count: uploaded.length });
  return product;
}

export async function removeProductImage(req) {
  const product = await Product.findById(req.params.id);
  if (!product) throw Object.assign(new Error("Product not found"), { status: 404 });
  const image = product.images.id(req.params.imageId);
  if (!image) throw Object.assign(new Error("Image not found"), { status: 404 });
  const result = await cloudinary.uploader.destroy(image.publicId, { resource_type: "image", invalidate: true });
  if (!["ok", "not found"].includes(result.result)) throw Object.assign(new Error("Image deletion failed; database reference retained"), { status: 502 });
  image.deleteOne();
  await product.save();
  await recordAudit(req, "PRODUCT_IMAGE_REMOVED", "Product", product._id);
  return product;
}

export async function deleteProduct(req) {
  const product = await Product.findById(req.params.id);
  if (!product) throw Object.assign(new Error("Product not found"), { status: 404 });
  if (product.stockQuantity > 0) throw Object.assign(new Error("Cannot delete a product with stock. Deactivate it or adjust stock to zero first."), { status: 409 });
  for (const image of product.images) await removeCloudImage(image.publicId);
  await Product.deleteOne({ _id: product._id });
  await recordAudit(req, "PRODUCT_DELETED", "Product", product._id, { sku: product.sku });
}

export async function getPublicProductBySlug(slug) {
  const product = await Product.findOne({ slug: String(slug || "").toLowerCase(), isActive: true })
    .populate("category", "name division").lean();
  if (!product) throw Object.assign(new Error("Product not found"), { status: 404 });
  return product;
}

export async function getPublicProductById(id) {
  // Validate MongoDB ObjectId
  if (!mongoose.isValidObjectId(id)) {
    throw Object.assign(
      new Error("Invalid product ID"),
      { status: 400 }
    );
  }

  // Fetch only active products
  const product = await Product.findOne({
    _id: id,
    isActive: true
  })
    .populate("category", "name division")
    .lean();

  if (!product) {
    throw Object.assign(
      new Error("Product not found or inactive"),
      { status: 404 }
    );
  }

  return product;
}

