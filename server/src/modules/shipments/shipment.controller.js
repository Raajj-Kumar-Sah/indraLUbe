import * as service from "./shipment.service.js";
export async function create(req,res,next){try{res.status(201).json({success:true,message:"Shipment registered",data:await service.createOrUpdateShipment(req)});}catch(e){next(e)}}
export async function adminList(req,res,next){try{res.json({success:true,data:await service.listShipments(req.query)});}catch(e){next(e)}}
export async function adminStatus(req,res,next){try{res.json({success:true,message:"Shipment status updated",data:await service.updateShipmentStatus(req)});}catch(e){next(e)}}
export async function mine(req,res,next){try{res.json({success:true,data:await service.listMyShipments(req.user.sub)});}catch(e){next(e)}}
export async function mineDetail(req,res,next){try{res.json({success:true,data:await service.getMyShipment(req.user.sub,req.params.orderId)});}catch(e){next(e)}}
export async function confirm(req,res,next){try{res.json({success:true,message:"Delivery confirmed successfully",data:await service.confirmDelivery(req)});}catch(e){next(e)}}
