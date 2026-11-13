import "dotenv/config";
import { connectDatabase } from "../src/config/db.js";
import mongoose from "mongoose";

await connectDatabase();
const db = mongoose.connection.db;
const adminUser = await db.collection("users").findOne({ role: "SUPER_ADMIN" });
const adminId = adminUser ? adminUser._id : new mongoose.Types.ObjectId();

const modules = [
  "Automotive Petrol & CNG Engine Oils",
  "Heavy-Duty Diesel & Fleet Engine Oils",
  "Tractor & Agricultural Machinery Oils",
  "Automotive Gear Oils & Transmission Fluids",
  "Brake Fluids & Steering / Suspension Fluids",
  "Diesel Exhaust Fluid (DEF / AUS 32 / AdBlue)",
  "Industrial Hydraulic, Compressor, Turbine & Gear Oils",
  "Greases & Specialty Compounds",
  "Fuel, Oil & Performance Additives",
  "Workshop Maintenance & Specialty Assembly Lubricants"
];

for (const name of modules) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  await db.collection("categories").updateOne(
    { slug, division: "IINDLUBE" },
    {
      $set: {
        name,
        slug,
        division: "IINDLUBE",
        isActive: true,
        createdBy: adminId,
        updatedAt: new Date()
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );
}

const count = await db.collection("categories").countDocuments({ division: "IINDLUBE" });
console.log("IINDLUBE Categories seeded successfully! Total:", count);
process.exit(0);
