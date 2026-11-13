export async function sendTransactionalEmail({to,subject,htmlText,textContent}){
 const key=process.env.BREVO_API_KEY;
 if(!key)throw new Error("Brevo email service is not configured");
 const senderEmail=process.env.BREVO_SENDER_EMAIL;
 const senderName=process.env.BREVO_SENDER_NAME||"Indira Industries HR";
 if(!senderEmail)throw new Error("Brevo sender email is not configured");
 const response=await fetch("https://api.brevo.com/v3/smtp/email",{
  method:"POST",headers:{"accept":"application/json","api-key":key,"content-type":"application/json"},
  body:JSON.stringify({sender:{name:senderName,email:senderEmail},to:[{email:to}],subject,htmlContent:htmlText,textContent})
 });
 if(!response.ok){const detail=await response.text();throw new Error(`Email delivery failed (${response.status}): ${detail.slice(0,300)}`)}
 return response.json();
}
