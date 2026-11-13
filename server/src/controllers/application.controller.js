import * as service from "../services/application.service.js";

export async function submit(req, res, next) {
  try {
    const data = await service.submitApplication(req.body);
    res.status(201).json({ success: true, data });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ message: "An application for this job and email already exists" });
    }
    next(e);
  }
}

export async function hrList(req, res, next) {
  try {
    const data = await service.listHrApplications(req.query);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function hrUpdateStage(req, res, next) {
  try {
    const data = await service.updateApplicationStage(req.params.id, req.body?.stage, req.user.sub);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}
