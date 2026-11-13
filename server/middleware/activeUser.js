import User from "../modules/auth/user.model.js";
export async function activeUser(req,res,next){
 try { const user=await User.findById(req.user.sub).select("role isActive emailVerifiedAt");
 if(!user?.isActive || !user.emailVerifiedAt) return res.status(403).json({success:false,message:"Account not active"});
 req.user.role=user.role; next();
 } catch(nextError){next(nextError)}
}
