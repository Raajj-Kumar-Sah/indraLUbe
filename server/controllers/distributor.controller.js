import * as service from "../services/distributor.service.js";

export async function list(req, res, next) {
  try {
    res.json({ success: true, data: await service.listDistributors(req.query) });
  } catch (e) {
    next(e);
  }
}

export async function detail(req, res, next) {
  try {
    res.json({ success: true, data: await service.getDistributor(req.params.id) });
  } catch (e) {
    next(e);
  }
}

export async function updateProfile(req, res, next) {
  try {
    res.json({ success: true, message: "Distributor profile updated", data: await service.updateDistributorProfile(req) });
  } catch (e) {
    next(e);
  }
}

export async function status(req, res, next) {
  try {
    res.json({ success: true, message: "Distributor approval status updated", data: await service.changeDistributorStatus(req) });
  } catch (e) {
    next(e);
  }
}

export async function active(req, res, next) {
  try {
    res.json({ success: true, message: "Distributor account status updated", data: await service.setDistributorActive(req) });
  } catch (e) {
    next(e);
  }
}
