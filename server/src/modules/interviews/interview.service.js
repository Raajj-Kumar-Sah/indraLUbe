import crypto from "node:crypto";
import mongoose from "mongoose";
import Interview from "./interview.model.js";
import Application from "../applications/application.model.js";
import {sendTransactionalEmail} from "../../services/email.js";
import {recordAudit} from "../../services/audit.js";
import {notifyUser} from "../notifications/notification.service.js";
const safeUrl=value=>{try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password}catch{return false}};
const escapeHtml=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export async function listInterviews(query={}){
 const filter={};if(query.status)filter.status=query.status;
 return Interview.find(filter).populate({path:"application",populate:{path:"job",select:"title"}}).sort({startsAt:1}).limit(250).lean();
}
export async function scheduleInterview(req){
 const b=req.body||{};
 if(!mongoose.isValidObjectId(req.params.applicationId))throw Object.assign(new Error("Invalid application"),{status:400});
 const app=await Application.findById(req.params.applicationId).populate("job","title");
 if(!app)throw Object.assign(new Error("Application not found"),{status:404});
 const startsAt=new Date(b.startsAt);
 if(!Number.isFinite(startsAt.getTime())||startsAt.getTime()<Date.now()+5*60*1000||startsAt.getTime()>Date.now()+180*24*60*60*1000)throw Object.assign(new Error("Interview must be scheduled between 5 minutes and 180 days from now"),{status:400});
 if(!["GOOGLE_MEET","ZOOM","IN_PERSON"].includes(b.mode))throw Object.assign(new Error("Select a valid interview mode"),{status:400});
 if(![15,30,45,60,90,120].includes(Number(b.durationMinutes)))throw Object.assign(new Error("Invalid interview duration"),{status:400});
 if(typeof b.interviewerName!=="string"||!b.interviewerName.trim()||b.interviewerName.length>120)throw Object.assign(new Error("Interviewer name is required"),{status:400});
 let meetingUrl=b.meetingUrl||"";
 if(b.mode==="IN_PERSON"){
  if(typeof b.location!=="string"||!b.location.trim()||b.location.length>300)throw Object.assign(new Error("Interview location is required"),{status:400});
 }else{
  if(!meetingUrl){
   if(b.mode==="ZOOM")meetingUrl=`https://zoom.us/j/${Math.floor(1000000000+Math.random()*9000000000)}?pwd=indira${crypto.randomBytes(3).toString("hex")}`;
   else if(b.mode==="GOOGLE_MEET")meetingUrl=`https://meet.google.com/${crypto.randomBytes(2).toString("hex")}-${crypto.randomBytes(2).toString("hex")}-${crypto.randomBytes(2).toString("hex")}`;
  }else if(!safeUrl(meetingUrl)){throw Object.assign(new Error("Provide a valid HTTPS meeting URL"),{status:400});}
 }
 const interview=await Interview.create({
  application:app._id,candidateEmail:app.email,candidateName:app.candidateName,
  scheduledBy:req.user.sub,startsAt,durationMinutes:Number(b.durationMinutes),
  mode:b.mode,meetingUrl,location:b.location||"",
  interviewerName:b.interviewerName.trim(),notes:typeof b.notes==="string"?b.notes.slice(0,1500):""
 });
 if(app.stage!=="Interview"){app.stage="Interview";app.history.push({stage:"Interview",at:new Date(),by:req.user.sub});await app.save();}
 const date=startsAt.toLocaleString("en-IN",{dateStyle:"full",timeStyle:"short",timeZone:"Asia/Kolkata"});
 const join=b.mode==="IN_PERSON"?`Venue: ${escapeHtml(b.location)}`:`Join link: <a href="${escapeHtml(b.meetingUrl)}">${escapeHtml(b.meetingUrl)}</a>`;
 try{
  await sendTransactionalEmail({to:app.email,subject:`Interview scheduled — ${app.job?.title||"Indira Industries"}`,htmlText:`<p>Dear ${escapeHtml(app.candidateName)},</p><p>Your interview for <b>${escapeHtml(app.job?.title||"the role")}</b> has been scheduled.</p><p><b>Date & time:</b> ${escapeHtml(date)} (IST)<br/><b>Duration:</b> ${Number(b.durationMinutes)} minutes<br/><b>Interviewer:</b> ${escapeHtml(b.interviewerName)}<br/>${join}</p><p>${escapeHtml(b.notes||"")}</p><p>Regards,<br/>Indira Industries HR</p>`,textContent:`Dear ${app.candidateName}, your interview for ${app.job?.title||"the role"} is scheduled on ${date} IST. Duration: ${b.durationMinutes} minutes. Interviewer: ${b.interviewerName}. ${b.mode==="IN_PERSON"?`Venue: ${b.location}`:`Join: ${b.meetingUrl}`} ${b.notes||""}`});
  interview.notificationStatus="SENT";
 }catch(error){interview.notificationStatus="FAILED";interview.notificationError=error.message.slice(0,500);}
 await interview.save();
 await recordAudit(req,"INTERVIEW_SCHEDULED","Interview",interview._id,{applicationId:String(app._id),notificationStatus:interview.notificationStatus});
 await notifyUser({recipient:req.user.sub,type:"INTERVIEW_SCHEDULED",title:"Interview scheduled",message:`Interview scheduled with ${app.candidateName} for ${app.job?.title||"a role"}.`,link:"/dashboard/hr/interviews",entityType:"Interview",entityId:interview.id});
 return {interview,notificationStatus:interview.notificationStatus};
}
export async function changeInterviewStatus(req){
 const {status}=req.body||{};
 if(!["COMPLETED","CANCELLED","RESCHEDULED"].includes(status))throw Object.assign(new Error("Invalid interview status"),{status:400});
 const doc=await Interview.findById(req.params.id);if(!doc)throw Object.assign(new Error("Interview not found"),{status:404});
 doc.status=status;await doc.save();await recordAudit(req,"INTERVIEW_"+status,"Interview",doc._id);
 return doc;
}
