import * as service from "../services/job.service.js";

export async function publicList(req, res, next) {
  try {
    const data = await service.listPublicJobs();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function publicDetail(req, res, next) {
  try {
    const data = await service.getPublicJobById(req.params.id);
    if (!data) return res.sendStatus(404);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function hrList(req, res, next) {
  try {
    const data = await service.listHrJobs();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function hrCreate(req, res, next) {
  try {
    const data = await service.createJob(req.body, req.user.sub);
    res.status(201).json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function hrUpdate(req, res, next) {
  try {
    const data = await service.updateJob(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}
