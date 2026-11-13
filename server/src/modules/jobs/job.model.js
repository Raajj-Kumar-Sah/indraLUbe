import mongoose from "mongoose";
const schema = new mongoose.Schema({
 title:{type:String,required:true,trim:true,maxlength:140},
 division:{type:String,required:true,enum:["IINDLUBE","IINDPURE","IINDSTYL","Corporate"]},
 department:{type:String,required:true,trim:true,maxlength:80},
 location:{type:String,required:true,trim:true,maxlength:120},
 type:{type:String,enum:["Full-time","Part-time","Contract","Internship"],default:"Full-time"},
 summary:{type:String,trim:true,maxlength:2000,default:""},
 status:{type:String,enum:["Draft","Published","Closed"],default:"Draft"},
 createdBy:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true}
},{timestamps:true});
schema.index({status:1,createdAt:-1});
export default mongoose.model("Job",schema);
