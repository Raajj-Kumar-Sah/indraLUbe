import mongoose from "mongoose";
const schema = new mongoose.Schema({
 job:{type:mongoose.Schema.Types.ObjectId,ref:"Job",required:true,index:true},
 candidateName:{type:String,required:true,trim:true,maxlength:120},
 email:{type:String,required:true,lowercase:true,trim:true,maxlength:254},
 phone:{type:String,required:true,trim:true,maxlength:25},
 location:{type:String,trim:true,maxlength:120,default:""},
 resumeUrl:{type:String,required:true,maxlength:1500},
 coverNote:{type:String,maxlength:3000,default:""},
 stage:{type:String,enum:["New","Shortlisted","Interview","Selected","Rejected","On Hold"],default:"New"},
 history:[{stage:String,at:Date,by:{type:mongoose.Schema.Types.ObjectId,ref:"User"}}]
},{timestamps:true});
schema.index({job:1,email:1},{unique:true});
export default mongoose.model("Application",schema);
