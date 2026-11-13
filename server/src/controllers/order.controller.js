import * as service from "../services/order.service.js";

export async function create(req, res, next) {
  try {
    res.status(201).json({
      success: true,
      message: "Order placed and stock reserved",
      data: await service.createOrder(req)
    });
  } catch (e) {
    next(e);
  }
}

export async function mine(req, res, next) {
  try {
    res.json({ success: true, data: await service.listMyOrders(req, req.query) });
  } catch (e) {
    next(e);
  }
}

export async function mineDetail(req, res, next) {
  try {
    res.json({ success: true, data: await service.getMyOrder(req, req.params.id) });
  } catch (e) {
    next(e);
  }
}

export async function adminList(req, res, next) {
  try {
    res.json({ success: true, data: await service.listAllOrders(req.query) });
  } catch (e) {
    next(e);
  }
}

export async function adminDetail(req, res, next) {
  try {
    res.json({ success: true, data: await service.getAdminOrder(req.params.id) });
  } catch (e) {
    next(e);
  }
}

export async function status(req, res, next) {
  try {
    res.json({
      success: true,
      message: "Order status updated",
      data: await service.updateOrderStatus(req)
    });
  } catch (e) {
    next(e);
  }
}

export async function shipment(req, res, next) {
  try {
    res.json({
      success: true,
      message: "Shipment details updated",
      data: await service.updateShipment(req)
    });
  } catch (e) {
    next(e);
  }
}
