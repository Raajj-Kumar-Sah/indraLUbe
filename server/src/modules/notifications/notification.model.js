import mongoose from "mongoose";
const schema=new mongoose.Schema({
 recipient:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
 type:{type:String,enum:["ORDER_PLACED","ORDER_STATUS","PAYMENT_SUCCESS","PAYMENT_FAILED","LOW_STOCK","APPLICATION_RECEIVED","INTERVIEW_SCHEDULED","SYSTEM"],default:"SYSTEM"},
 title:{type:String,required:true,trim:true,maxlength:140},
 message:{type:String,required:true,trim:true,maxlength:500},
 link:{type:String,default:"",maxlength:300},
 entityType:{type:String,default:""},
 entityId:{type:String,default:""},
 readAt:{type:Date,default:null,index:true},
 emailStatus:{type:String,enum:["NOT_REQUESTED","PENDING","SENT","FAILED"],default:"NOT_REQUESTED"}
},{timestamps:true});
schema.index({recipient:1,createdAt:-1});
export default mongoose.model("Notification",schema);
