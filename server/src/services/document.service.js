import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cloudinary from "../config/cloudinary.js";
import EnterpriseDocument from "../models/document.model.js";
import PartnershipInquiry from "../models/partnershipInquiry.model.js";
import {
  generateDefaultCatalog,
  generateDefaultApplication,
  generateDefaultAgreement
} from "./defaultPdfs.js";
import { sendTransactionalEmail } from "./email.js";
import { notifyRoles } from "./notification.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../uploads/documents");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const DEFAULT_DOCS = [
  {
    key: "iindlube_catalog",
    title: "IINDLUBE Comprehensive Product Catalogue",
    description: "Full technical specifications, viscosities, and application guidelines for automotive and industrial lubricants.",
    category: "CATALOG",
    division: "IINDLUBE"
  },
  {
    key: "partnership_application",
    title: "Channel Partnership & Distributorship Application Form",
    description: "Official application document to apply for territorial distributorship and retail dealership.",
    category: "PARTNERSHIP_FORM",
    division: "IINDLUBE"
  },
  {
    key: "partnership_agreement",
    title: "Authorized Distributor Agreement Terms",
    description: "Commercial dealership terms, stocking commitments, warranty standards, and legal covenants.",
    category: "AGREEMENT",
    division: "IINDLUBE"
  }
];

function hasCloudinary() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function uploadBufferToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "indira_documents",
        resource_type: "auto",
        public_id: `${path.parse(filename).name}_${Date.now()}`
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

export async function listAllDocuments() {
  const existing = await EnterpriseDocument.find().sort({ createdAt: -1 }).lean();
  const existingMap = new Map(existing.map((d) => [d.key, d]));

  return DEFAULT_DOCS.map((def) => {
    const doc = existingMap.get(def.key);
    if (doc) {
      return {
        ...doc,
        isCustom: true,
        downloadUrl: `/api/documents/download/${def.key}`
      };
    }
    return {
      key: def.key,
      title: def.title,
      description: def.description,
      category: def.category,
      division: def.division,
      fileUrl: `/api/documents/download/${def.key}`,
      downloadUrl: `/api/documents/download/${def.key}`,
      fileName: `${def.key}.pdf`,
      fileSize: 0,
      mimeType: "application/pdf",
      version: 1,
      isCustom: false,
      updatedAt: new Date()
    };
  });
}

export async function uploadDocumentFile(key, file, body, user) {
  if (!file) {
    throw Object.assign(new Error("File is required for upload"), { status: 400 });
  }

  const cleanKey = key.toLowerCase().trim();
  let fileUrl = "";
  let cloudinaryPublicId = "";

  if (hasCloudinary()) {
    try {
      const uploaded = await uploadBufferToCloudinary(file.buffer, file.originalname);
      fileUrl = uploaded.secure_url;
      cloudinaryPublicId = uploaded.public_id;
    } catch (err) {
      console.warn("Cloudinary upload failed, falling back to local storage:", err.message);
    }
  }

  if (!fileUrl) {
    const safeName = `${cleanKey}_${Date.now()}${path.extname(file.originalname)}`;
    const diskPath = path.join(uploadsDir, safeName);
    fs.writeFileSync(diskPath, file.buffer);
    fileUrl = `/uploads/documents/${safeName}`;
  }

  const existing = await EnterpriseDocument.findOne({ key: cleanKey });
  const title = body?.title || existing?.title || cleanKey.replace(/_/g, " ").toUpperCase();
  const description = body?.description || existing?.description || "";
  const category = body?.category || existing?.category || "OTHER";
  const division = body?.division || existing?.division || "IINDLUBE";
  const version = (existing?.version || 1) + 1;

  const updated = await EnterpriseDocument.findOneAndUpdate(
    { key: cleanKey },
    {
      $set: {
        title,
        description,
        category,
        division,
        fileUrl,
        cloudinaryPublicId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        version,
        updatedBy: user?.sub || null
      }
    },
    { upsert: true, new: true, runValidators: true }
  );

  return updated;
}

export async function downloadDocument(key, res) {
  const cleanKey = key.toLowerCase().trim();
  const existing = await EnterpriseDocument.findOne({ key: cleanKey });

  if (existing && existing.fileUrl) {
    if (existing.fileUrl.startsWith("http://") || existing.fileUrl.startsWith("https://")) {
      return res.redirect(existing.fileUrl);
    }
    if (existing.fileUrl.startsWith("/uploads/documents/")) {
      const filename = path.basename(existing.fileUrl);
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath)) {
        res.setHeader("Content-Disposition", `attachment; filename="${existing.fileName || filename}"`);
        return res.sendFile(filePath);
      }
    }
  }

  if (cleanKey === "iindlube_catalog") {
    return generateDefaultCatalog(res);
  }
  if (cleanKey === "partnership_application") {
    return generateDefaultApplication(res);
  }
  if (cleanKey === "partnership_agreement") {
    return generateDefaultAgreement(res);
  }

  throw Object.assign(new Error("Document not found"), { status: 404 });
}

export async function resetDocument(key) {
  const cleanKey = key.toLowerCase().trim();
  await EnterpriseDocument.deleteOne({ key: cleanKey });
  return { success: true, message: `Document '${key}' reset to default system file.` };
}

export async function submitPartnershipInquiry(body) {
  const {
    companyName,
    applicantName,
    email,
    phone,
    city,
    state,
    investmentCapacity,
    storageSpace,
    experienceYears,
    message
  } = body || {};

  if (!companyName || !applicantName || !email || !phone || !city || !state) {
    throw Object.assign(new Error("Please fill all required business and contact details"), { status: 400 });
  }

  const doc = await PartnershipInquiry.create({
    companyName: companyName.trim(),
    applicantName: applicantName.trim(),
    email: email.toLowerCase().trim(),
    phone: phone.trim(),
    city: city.trim(),
    state: state.trim(),
    investmentCapacity: investmentCapacity || "",
    storageSpace: storageSpace || "",
    experienceYears: experienceYears || "",
    message: message || ""
  });

  try {
    await sendTransactionalEmail({
      to: doc.email,
      subject: "Indira Industries — IINDLUBE Partnership Inquiry Received",
      htmlText: `
        <p>Dear ${doc.applicantName},</p>
        <p>Thank you for expressing interest in partnering with <strong>Indira Industries Petrochemicals Division (IINDLUBE)</strong>.</p>
        <p>We have registered your dealership/distributorship inquiry for <strong>${doc.city}, ${doc.state}</strong>.</p>
        <p>Our Regional Channel Development team will review your business credentials and contact you within 2 business days.</p>
        <br/>
        <p>Corporate Office: 905 Station Road, Ahmedabad, Gujarat – 382440<br/>
        Contact: iindlube@indiraindustries.co.in | www.indiraindustries.co.in</p>
      `,
      textContent: `Dear ${doc.applicantName}, thank you for your IINDLUBE partnership inquiry for ${doc.city}, ${doc.state}. Our Channel Development team will reach out shortly. Indira Industries Petrochemicals Division.`
    });
  } catch (mailErr) {
    console.warn("Partnership inquiry notification email failed:", mailErr.message);
  }

  await notifyRoles(["ADMIN", "SUPER_ADMIN"], {
    type: "PARTNERSHIP_INQUIRY",
    title: "New IINDLUBE Partnership Inquiry",
    message: `${doc.companyName} (${doc.applicantName}) applied for distributorship in ${doc.city}, ${doc.state}.`,
    link: "/dashboard/admin/documents",
    entityType: "PartnershipInquiry",
    entityId: doc.id
  });

  return {
    success: true,
    message: "Thank you! Your partnership inquiry has been submitted. Our commercial desk will contact you shortly."
  };
}

export async function listPartnershipInquiries() {
  return PartnershipInquiry.find().sort({ createdAt: -1 }).limit(200).lean();
}
