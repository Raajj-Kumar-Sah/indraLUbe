import mongoose from "mongoose";
const eventSchema=new mongoose.Schema({
 status:{type:String,required:true},
 note:{type:String,trim:true,maxlength:300,default:""},
 changedBy:{type:mongoose.Schema.Types.ObjectId,ref:"User",default:null},
 changedAt:{type:Date,default:Date.now}
},{_id:false});
const schema=new mongoose.Schema({
 order:{type:mongoose.Schema.Types.ObjectId,ref:"Order",required:true,unique:true,index:true},
 distributor:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
 orderNumber:{type:String,required:true,index:true},
 carrier:{type:String,trim:true,required:true,maxlength:100},
 trackingNumber:{type:String,trim:true,required:true,maxlength:120},
 trackingUrl:{type:String,trim:true,default:"",maxlength:500},
 estimatedDelivery:{type:Date,default:null},
 status:{type:String,enum:["CREATED","PICKED_UP","IN_TRANSIT","OUT_FOR_DELIVERY","DELIVERY_FAILED","DELIVERED","RETURN_INITIATED","RETURNED"],default:"CREATED",index:true},
 events:{type:[eventSchema],default:[]},
 deliveryOtpHash:{type:String,default:"",select:false},
 deliveryOtpExpiresAt:{type:Date,default:null},
 otpAttempts:{type:Number,default:0,min:0},
 otpLockedUntil:{type:Date,default:null},
 deliveredAt:{type:Date,default:null},
 failureReason:{type:String,trim:true,default:"",maxlength:300},
 returnReason:{type:String,trim:true,default:"",maxlength:300}
},{timestamps:true});
schema.index({distributor:1,createdAt:-1});
export default mongoose.model("Shipment",schema);
