import Category from "../models/category.model.js";
import { recordAudit } from "./audit.js";

const divisions = ["IINDLUBE", "IINDPURE", "IINDSTYL", "Corporate"];
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function listCategories(query = {}) {
  const filter = {};
  if (query.division && divisions.includes(query.division)) filter.division = query.division;
  if (query.includeInactive === "true") {} else filter.isActive = true;
  return Category.find(filter).sort({ name: 1 }).lean();
}

export async function createCategory(req) {
  const { name, division } = req.body;
  if (!String(name || "").trim() || !divisions.includes(division)) throw Object.assign(new Error("Valid category name and division are required"), { status: 400 });
  const category = await Category.create({ name, division, slug: `${slugify(name)}-${division.toLowerCase()}`, createdBy: req.user.sub });
  await recordAudit(req, "CATEGORY_CREATED", "Category", category._id);
  return category;
}

export async function updateCategory(req) {
  const category = await Category.findById(req.params.id);
  if (!category) throw Object.assign(new Error("Category not found"), { status: 404 });
  if (req.body.name !== undefined) category.name = String(req.body.name).trim();
  if (req.body.isActive !== undefined) category.isActive = Boolean(req.body.isActive);
  await category.save();
  await recordAudit(req, "CATEGORY_UPDATED", "Category", category._id);
  return category;
}
