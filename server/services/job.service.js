import mongoose from "mongoose";
import Job from "../models/job.model.js";

const fields = ["title", "division", "department", "location", "type", "summary", "status"];
const valid = (v) => typeof v === "string";

export const invalidJob = (body, partial = false) =>
  !body ||
  typeof body !== "object" ||
  Object.keys(body).some(k => !fields.includes(k)) ||
  (!partial && ["title", "division", "department", "location"].some(k => !valid(body[k]) || !body[k].trim())) ||
  Object.entries(body).some(([k, v]) => !valid(v) || v.length > ({ summary: 2000, title: 140, location: 120, department: 80 }[k] || 30));

export const safeJob = (doc) => ({
  id: doc.id,
  title: doc.title,
  division: doc.division,
  department: doc.department,
  location: doc.location,
  type: doc.type,
  summary: doc.summary,
  status: doc.status
});

export async function listPublicJobs() {
  const docs = await Job.find({ status: "Published" }).sort({ createdAt: -1 }).limit(100);
  return docs.map(safeJob);
}

export async function getPublicJobById(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await Job.findOne({ _id: id, status: "Published" });
  return doc ? safeJob(doc) : null;
}

export async function listHrJobs() {
  const docs = await Job.find().sort({ createdAt: -1 }).limit(200);
  return docs.map(safeJob);
}

export async function createJob(body, userId) {
  if (invalidJob(body)) throw Object.assign(new Error("Invalid job details"), { status: 400 });
  const doc = await Job.create({ ...body, createdBy: userId });
  return safeJob(doc);
}

export async function updateJob(id, body) {
  if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error("Job not found"), { status: 404 });
  if (invalidJob(body, true) || !Object.keys(body).length) throw Object.assign(new Error("Invalid update"), { status: 400 });
  const doc = await Job.findById(id);
  if (!doc) throw Object.assign(new Error("Job not found"), { status: 404 });
  Object.assign(doc, body);
  await doc.save();
  return safeJob(doc);
}
