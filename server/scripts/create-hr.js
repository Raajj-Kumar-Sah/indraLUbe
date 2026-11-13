import "dotenv/config";
import { connectDatabase } from "../src/config/db.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

await connectDatabase();
const db = mongoose.connection.db;
const usersCol = db.collection("users");

const email = "hr@indiraindustries.co.in";
const rawPassword = "HR@Indira2025";
const hash = await bcrypt.hash(rawPassword, 12);

await usersCol.updateOne(
  { email },
  {
    $set: {
      name: "Indira HR Department",
      email,
      passwordHash: hash,
      authProvider: "LOCAL",
      role: "HR",
      isActive: true,
      emailVerifiedAt: new Date(),
      failedLoginAttempts: 0,
      lockUntil: null,
      passwordChangedAt: null,
      updatedAt: new Date()
    },
    $setOnInsert: {
      createdAt: new Date()
    }
  },
  { upsert: true }
);

const created = await usersCol.findOne({ email });
console.log("HR_ACCOUNT_READY:", {
  id: created._id.toString(),
  name: created.name,
  email: created.email,
  role: created.role,
  isActive: created.isActive,
  emailVerified: !!created.emailVerifiedAt
});
process.exit(0);
