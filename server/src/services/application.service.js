import mongoose from "mongoose";
import Application from "../models/application.model.js";
import Job from "../models/job.model.js";
import { notifyRoles } from "./notification.service.js";
import { sendTransactionalEmail } from "./email.js";

export const applicationStages = ["New", "Shortlisted", "Interview", "Selected", "Rejected", "On Hold"];

export const safeApplication = a => ({
  id: a.id,
  name: a.candidateName,
  email: a.email,
  phone: a.phone,
  location: a.location,
  resumeUrl: a.resumeUrl,
  coverNote: a.coverNote,
  role: a.job?.title || "",
  jobId: a.job?.id || a.job,
  received: a.createdAt.toISOString().slice(0, 10),
  stage: a.stage,
  history: a.history
});

export async function submitApplication(b) {
  const keys = ["jobId", "candidateName", "email", "phone", "location", "resumeUrl", "coverNote", "consent"];
  if (
    !b ||
    typeof b !== "object" ||
    Object.keys(b).some(k => !keys.includes(k)) ||
    !mongoose.isValidObjectId(b.jobId) ||
    (b.consent !== true && b.consent !== "true") ||
    typeof b.candidateName !== "string" ||
    !b.candidateName.trim() ||
    b.candidateName.length > 120 ||
    typeof b.email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(b.email) ||
    b.email.length > 254 ||
    typeof b.phone !== "string" ||
    !/^[+0-9 ()-]{7,25}$/.test(b.phone) ||
    typeof b.resumeUrl !== "string" ||
    b.resumeUrl.length > 1500 ||
    (typeof b.coverNote !== "undefined" && (typeof b.coverNote !== "string" || b.coverNote.length > 3000)) ||
    (typeof b.location !== "undefined" && (typeof b.location !== "string" || b.location.length > 120))
  ) {
    throw Object.assign(new Error("Invalid application details"), { status: 400 });
  }

  let u;
  try {
    u = new URL(b.resumeUrl);
  } catch {
    throw Object.assign(new Error("Invalid resume URL"), { status: 400 });
  }
  if (u.protocol !== "https:" || u.username || u.password) {
    throw Object.assign(new Error("Resume URL must use HTTPS"), { status: 400 });
  }

  const job = await Job.findOne({ _id: b.jobId, status: "Published" });
  if (!job) throw Object.assign(new Error("Job is not available"), { status: 404 });

  const doc = await Application.create({
    job: job.id,
    candidateName: b.candidateName.trim(),
    email: b.email.toLowerCase().trim(),
    phone: b.phone.trim(),
    location: b.location?.trim() || "",
    resumeUrl: b.resumeUrl.trim(),
    coverNote: b.coverNote?.trim() || "",
    history: [{ stage: "New", at: new Date() }]
  });

  // Notify internal team
  await notifyRoles(["HR", "ADMIN", "SUPER_ADMIN"], {
    type: "APPLICATION_RECEIVED",
    title: "New job application",
    message: `${doc.candidateName} applied for ${job.title}.`,
    link: "/dashboard/hr/applications",
    entityType: "Application",
    entityId: doc.id
  });

  // Send candidate application confirmation via Brevo
  try {
    await sendTransactionalEmail({
      to: doc.email,
      subject: `Application Received — ${job.title} at Indira Industries`,
      htmlText: `
        <p>Dear ${doc.candidateName},</p>
        <p>Thank you for applying for the <strong>${job.title}</strong> position at Indira Industries.</p>
        <p>Our Human Resources team has received your application and resume. We will review your profile against our role requirements and contact you if your qualifications align with our current hiring needs.</p>
        <p>Best regards,<br/><strong>Human Resources Department</strong><br/>Indira Industries</p>
      `,
      textContent: `Dear ${doc.candidateName}, thank you for applying for ${job.title} at Indira Industries. Our HR team has received your application and will review it shortly. Best regards, Indira Industries HR.`
    });
  } catch (mailErr) {
    console.warn("Application confirmation email failed to dispatch:", mailErr.message);
  }

  return { id: doc.id, message: "Application received" };
}

export async function listHrApplications(query = {}) {
  const { stage, search, jobId } = query;
  const filter = {};

  if (stage) {
    if (!applicationStages.includes(stage)) throw Object.assign(new Error("Invalid stage"), { status: 400 });
    filter.stage = stage;
  }

  if (jobId && mongoose.isValidObjectId(jobId)) {
    filter.job = jobId;
  }

  if (search && typeof search === "string" && search.trim()) {
    const term = search.trim();
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { candidateName: regex },
      { email: regex },
      { phone: regex },
      { location: regex },
      { coverNote: regex }
    ];
  }

  const docs = await Application.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("job", "title department location");

  return docs.map(safeApplication);
}

export async function updateApplicationStage(id, stage, userSub) {
  if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error("Application not found"), { status: 404 });
  if (!applicationStages.includes(stage)) throw Object.assign(new Error("Invalid stage"), { status: 400 });

  const doc = await Application.findById(id).populate("job", "title");
  if (!doc) throw Object.assign(new Error("Application not found"), { status: 404 });

  if (doc.stage !== stage) {
    doc.stage = stage;
    doc.history.push({ stage, at: new Date(), by: userSub });
    await doc.save();

    if (stage === "Selected" || stage === "Rejected" || stage === "On Hold" || stage === "Shortlisted") {
      try {
        const subject = stage === "Selected"
          ? `Congratulations! Offer Update — ${doc.job?.title || "Indira Industries"}`
          : stage === "Shortlisted"
          ? `Application Update: Shortlisted for ${doc.job?.title || "Indira Industries"}`
          : `Application Status Update — ${doc.job?.title || "Indira Industries"}`;

        let messageBody = `<p>Dear ${doc.candidateName},</p>`;
        if (stage === "Selected") {
          messageBody += `<p>We are pleased to inform you that you have been selected for the position of <strong>${doc.job?.title}</strong> at Indira Industries! Our HR team will reach out with onboarding details.</p>`;
        } else if (stage === "Shortlisted") {
          messageBody += `<p>Your profile for the position of <strong>${doc.job?.title}</strong> has been shortlisted. Our recruitment team will contact you soon regarding next steps.</p>`;
        } else if (stage === "On Hold") {
          messageBody += `<p>Thank you for interviewing for <strong>${doc.job?.title}</strong>. Your candidacy is currently on hold as we complete initial interview rounds. We will keep you updated.</p>`;
        } else if (stage === "Rejected") {
          messageBody += `<p>Thank you for taking the time to apply and interview for <strong>${doc.job?.title}</strong>. After careful consideration, we have decided to move forward with other candidates whose profiles more closely match our current requirements. We wish you every success in your job search.</p>`;
        }
        messageBody += `<p>Regards,<br/><strong>Human Resources Department</strong><br/>Indira Industries</p>`;

        await sendTransactionalEmail({
          to: doc.email,
          subject,
          htmlText: messageBody,
          textContent: `Dear ${doc.candidateName}, your application status for ${doc.job?.title} has been updated to: ${stage}. Regards, Indira Industries HR.`
        });
      } catch (mailErr) {
        console.warn("Status notification email failed to dispatch:", mailErr.message);
      }
    }
  }

  return safeApplication(doc);
}
