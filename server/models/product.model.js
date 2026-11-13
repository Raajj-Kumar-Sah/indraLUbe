import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  publicId: { type: String, required: true },
  url: { type: String, required: true },
  alt: { type: String, trim: true, maxlength: 160, default: "" }
});

const productSchema = new mongoose.Schema({
  sku: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 180 },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
  division: { type: String, required: true, enum: ["IINDLUBE", "IINDPURE", "IINDSTYL", "Corporate"] },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
  brand: { type: String, required: true, trim: true, maxlength: 100 },
  shortDescription: { type: String, trim: true, maxlength: 500, default: "" },
  description: { type: String, trim: true, maxlength: 10000, default: "" },
  specifications: [{ key: { type: String, trim: true, maxlength: 80 }, value: { type: String, trim: true, maxlength: 300 } }],
  price: { type: Number, required: true, min: 0 },
  distributorPrice: { type: Number, min: 0, default: null },
  currency: { type: String, enum: ["INR"], default: "INR" },
  stockQuantity: { type: Number, min: 0, default: 0 },
  reorderLevel: { type: Number, min: 0, default: 10 },
  isActive: { type: Boolean, default: true },
  images: { type: [imageSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

productSchema.index({ name: "text", sku: "text", brand: "text", shortDescription: "text" });
productSchema.index({ division: 1, isActive: 1, category: 1 });
export default mongoose.model("Product", productSchema);
