import * as service from "./interview.service.js";
export async function list(req,res,next){try{res.json({success:true,data:await service.listInterviews(req.query)});}catch(e){next(e)}}
export async function schedule(req,res,next){try{const result=await service.scheduleInterview(req);res.status(201).json({success:true,message:result.notificationStatus==="SENT"?"Interview scheduled and candidate notified":"Interview scheduled, but email notification failed",data:result});}catch(e){next(e)}}
export async function status(req,res,next){try{res.json({success:true,data:await service.changeInterviewStatus(req)});}catch(e){next(e)}}
