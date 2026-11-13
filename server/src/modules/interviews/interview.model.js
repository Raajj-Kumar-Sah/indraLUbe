import mongoose from "mongoose";
const schema=new mongoose.Schema({
 application:{type:mongoose.Schema.Types.ObjectId,ref:"Application",required:true,index:true},
 candidateEmail:{type:String,required:true,lowercase:true,trim:true},
 candidateName:{type:String,required:true},
 scheduledBy:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 startsAt:{type:Date,required:true},
 durationMinutes:{type:Number,enum:[15,30,45,60,90,120],default:30},
 mode:{type:String,enum:["GOOGLE_MEET","ZOOM","IN_PERSON"],required:true},
 meetingUrl:{type:String,default:""},
 location:{type:String,default:""},
 interviewerName:{type:String,required:true,maxlength:120},
 notes:{type:String,maxlength:1500,default:""},
 status:{type:String,enum:["SCHEDULED","COMPLETED","CANCELLED","RESCHEDULED"],default:"SCHEDULED"},
 notificationStatus:{type:String,enum:["PENDING","SENT","FAILED"],default:"PENDING"},
 notificationError:{type:String,default:""}
},{timestamps:true});
schema.index({startsAt:1,status:1});
export default mongoose.model("Interview",schema);
