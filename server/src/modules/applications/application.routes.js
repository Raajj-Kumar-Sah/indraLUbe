import { Router } from "express";
import mongoose from "mongoose";
import Application from "./application.model.js";
import Job from "../jobs/job.model.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { notifyRoles } from "../notifications/notification.service.js";
import { sendTransactionalEmail } from "../../services/email.js";

const publicRouter = Router();
const hrRouter = Router();
const stages = ["New", "Shortlisted", "Interview", "Selected", "Rejected", "On Hold"];

const safe = a => ({
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

publicRouter.post("/", async (req, res, next) => {
  try {
    const b = req.body || {};
    const keys = ["jobId", "candidateName", "email", "phone", "location", "resumeUrl", "coverNote", "consent"];
    if (
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
      return res.status(400).json({ message: "Invalid application details" });
    }

    let u;
    try {
      u = new URL(b.resumeUrl);
    } catch {
      return res.status(400).json({ message: "Invalid resume URL" });
    }
    if (u.protocol !== "https:" || u.username || u.password) {
      return res.status(400).json({ message: "Resume URL must use HTTPS" });
    }

    const job = await Job.findOne({ _id: b.jobId, status: "Published" });
    if (!job) return res.status(404).json({ message: "Job is not available" });

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

    res.status(201).json({ success: true, data: { id: doc.id, message: "Application received" } });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: "An application for this job and email already exists" });
    next(e);
  }
});

hrRouter.use(authenticate, authorize("HR", "ADMIN", "SUPER_ADMIN"));

hrRouter.get("/", async (req, res, next) => {
  try {
    const { stage, search, jobId } = req.query;
    const query = {};

    if (stage) {
      if (!stages.includes(stage)) return res.status(400).json({ message: "Invalid stage" });
      query.stage = stage;
    }

    if (jobId && mongoose.isValidObjectId(jobId)) {
      query.job = jobId;
    }

    if (search && typeof search === "string" && search.trim()) {
      const term = search.trim();
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [
        { candidateName: regex },
        { email: regex },
        { phone: regex },
        { location: regex },
        { coverNote: regex }
      ];
    }

    const docs = await Application.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("job", "title department location");

    res.json({ success: true, data: docs.map(safe) });
  } catch (e) {
    next(e);
  }
});

hrRouter.patch("/:id/stage", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404);
    const { stage } = req.body || {};
    if (!stages.includes(stage)) return res.status(400).json({ message: "Invalid stage" });

    const doc = await Application.findById(req.params.id).populate("job", "title");
    if (!doc) return res.sendStatus(404);

    if (doc.stage !== stage) {
      const oldStage = doc.stage;
      doc.stage = stage;
      doc.history.push({ stage, at: new Date(), by: req.user.sub });
      await doc.save();

      // Dispatch Brevo notification on decision stages
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

    res.json({ success: true, data: safe(doc) });
  } catch (e) {
    next(e);
  }
});

export { publicRouter as publicApplicationRoutes, hrRouter as hrApplicationRoutes };
