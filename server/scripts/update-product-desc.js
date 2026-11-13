import "dotenv/config";
import { connectDatabase } from "../src/config/db.js";
import mongoose from "mongoose";

await connectDatabase();
const db = mongoose.connection.db;

const desc = "HydroFlow ISO VG 46 / 68 is a high thermal stability, anti-wear hydraulic oil specifically engineered for CNC machines, industrial presses, cranes, earthmovers and injection molding systems. Formulated with premium zinc-free additives preventing valve sticking, pump cavitation, and sludge formation over extended service intervals up to 5,000 operating hours. Fully compliant with DIN 51524 Part 2 (HLP) and ISO 11158 standards.";

await db.collection("products").updateMany(
  { $or: [{ description: "" }, { description: null }] },
  { $set: { description: desc } }
);

const updated = await db.collection("products").findOne({});
console.log("Updated product full description:", updated?.description);
process.exit(0);
