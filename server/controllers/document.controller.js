import {
  listAllDocuments,
  uploadDocumentFile,
  downloadDocument,
  resetDocument,
  submitPartnershipInquiry,
  listPartnershipInquiries
} from "../services/document.service.js";

export async function listPublic(req, res, next) {
  try {
    const docs = await listAllDocuments();
    res.json({ success: true, data: docs });
  } catch (e) {
    next(e);
  }
}

export async function download(req, res, next) {
  try {
    await downloadDocument(req.params.key, res);
  } catch (e) {
    next(e);
  }
}

export async function submitInquiry(req, res, next) {
  try {
    const result = await submitPartnershipInquiry(req.body);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

export async function adminList(req, res, next) {
  try {
    const [documents, inquiries] = await Promise.all([
      listAllDocuments(),
      listPartnershipInquiries()
    ]);
    res.json({ success: true, data: { documents, inquiries } });
  } catch (e) {
    next(e);
  }
}

export async function upload(req, res, next) {
  try {
    const doc = await uploadDocumentFile(req.params.key, req.file, req.body, req.user);
    res.status(201).json({
      success: true,
      message: `Document '${doc.title}' updated successfully.`,
      data: doc
    });
  } catch (e) {
    next(e);
  }
}

export async function reset(req, res, next) {
  try {
    const result = await resetDocument(req.params.key);
    res.json(result);
  } catch (e) {
    next(e);
  }
}
