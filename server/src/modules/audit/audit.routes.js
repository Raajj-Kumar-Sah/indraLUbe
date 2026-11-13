import {Router} from "express";
import AuditLog from "./auditLog.model.js";
import AuthEvent from "../auth/authEvent.model.js";
import User from "../auth/user.model.js";
import {recordAudit} from "../../services/audit.js";
import {authenticate} from "../../middleware/authenticate.js";
import {authorize} from "../../middleware/authorize.js";
const router=Router();
router.use(authenticate,authorize("ADMIN","SUPER_ADMIN"));
router.get("/",async(req,res,next)=>{try{
 const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||30));
 const filter={};if(req.query.action)filter.action=String(req.query.action).slice(0,100);
 if(req.query.actor&&/^[a-f\\d]{24}$/i.test(req.query.actor))filter.actor=req.query.actor;
 const [items,total]=await Promise.all([AuditLog.find(filter).populate("actor","name email role").sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),AuditLog.countDocuments(filter)]);
 res.json({success:true,data:{items,total,page,limit}});
 }catch(e){next(e)}});
router.get("/auth-events",async(req,res,next)=>{try{
 const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||30));
 const [items,total]=await Promise.all([AuthEvent.find().populate("user","name email role").sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),AuthEvent.countDocuments()]);
 res.json({success:true,data:{items,total,page,limit}});
 }catch(e){next(e)}});
router.get("/users",async(req,res,next)=>{try{
 const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||50));
 const q=String(req.query.search||"").trim().slice(0,100),filter=q?{$or:[{name:{$regex:q,$options:"i"}},{email:{$regex:q,$options:"i"}}]}:{};
 const [items,total]=await Promise.all([User.find(filter).select("name email role isActive emailVerifiedAt createdAt lockUntil failedLoginAttempts").sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),User.countDocuments(filter)]);
 res.json({success:true,data:{items,total,page,limit}});
 }catch(e){next(e)}});
router.patch("/users/:id/access",authorize("SUPER_ADMIN"),async(req,res,next)=>{try{
 const {isActive}=req.body||{};if(typeof isActive!=="boolean")return res.status(400).json({message:"isActive must be a boolean"});
 const target=await User.findById(req.params.id);if(!target)return res.sendStatus(404);
 if(String(target._id)===req.user.sub)return res.status(409).json({message:"You cannot deactivate your own account"});
 if(target.role==="SUPER_ADMIN"&&isActive===false)return res.status(403).json({message:"Super Admin accounts cannot be deactivated here"});
 target.isActive=isActive;await target.save();await recordAudit(req,isActive?"USER_ACTIVATED":"USER_DEACTIVATED","User",target._id,{role:target.role});
 res.json({success:true,data:{id:target.id,isActive:target.isActive}});
 }catch(e){next(e)}});
router.patch("/users/:id/role",authorize("SUPER_ADMIN"),async(req,res,next)=>{try{
 const {role}=req.body||{};if(!["ADMIN","HR","DISTRIBUTOR"].includes(role))return res.status(400).json({message:"Invalid role"});
 const target=await User.findById(req.params.id);if(!target)return res.sendStatus(404);
 if(target.role==="SUPER_ADMIN"||String(target._id)===req.user.sub)return res.status(403).json({message:"This account role cannot be changed here"});
 target.role=role;await target.save();await recordAudit(req,"USER_ROLE_CHANGED","User",target._id,{role});
 res.json({success:true,data:{id:target.id,role:target.role}});
 }catch(e){next(e)}});
export default router;
