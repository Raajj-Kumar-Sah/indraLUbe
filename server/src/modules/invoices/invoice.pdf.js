import PDFDocument from "pdfkit";
export function streamInvoicePdf(invoice,res){
  const doc=new PDFDocument({size:"A4",margin:48,info:{Title:invoice.invoiceNumber,Author:"Indira Industries"}});
  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition",`attachment; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);
  doc.fontSize(20).text("INDIRA INDUSTRIES",{continued:true}).fontSize(10).text("                         TAX INVOICE");
  doc.moveDown().fontSize(11).text(`Invoice: ${invoice.invoiceNumber}`).text(`Issued: ${new Date(invoice.issuedAt).toLocaleDateString("en-IN")}`);
  doc.moveDown().fontSize(12).text("Bill To");
  doc.fontSize(10).text(invoice.billTo?.companyName||invoice.billTo?.name||"Distributor")
    .text(invoice.billTo?.name||"").text(invoice.billTo?.email||"").text(invoice.billTo?.gstin?`GSTIN: ${invoice.billTo.gstin}`:"");
  const a=invoice.billTo?.address||{};
  doc.text([a.line1,a.line2,a.city,a.state,a.postalCode,a.country].filter(Boolean).join(", "));
  doc.moveDown().fontSize(10);
  const y=doc.y;
  doc.text("SKU",48,y,{width:75}).text("Description",125,y,{width:190}).text("Qty",320,y,{width:35,align:"right"}).text("Unit",360,y,{width:70,align:"right"}).text("Amount",435,y,{width:110,align:"right"});
  doc.moveTo(48,y+18).lineTo(545,y+18).stroke();
  let rowY=y+26;
  for(const item of invoice.items){
    doc.text(item.sku,48,rowY,{width:75}).text(item.name,125,rowY,{width:190}).text(String(item.quantity),320,rowY,{width:35,align:"right"}).text(`Rs. ${Number(item.unitPrice).toFixed(2)}`,360,rowY,{width:70,align:"right"}).text(`Rs. ${Number(item.lineTotal).toFixed(2)}`,435,rowY,{width:110,align:"right"});
    rowY+=30;
    if(rowY>690){doc.addPage();rowY=55;}
  }
  doc.moveTo(350,rowY+8).lineTo(545,rowY+8).stroke();
  rowY+=20;
  for(const [label,value] of [["Subtotal",invoice.subtotal],["Tax",invoice.taxAmount],["Shipping",invoice.shippingAmount],["Total",invoice.totalAmount]]){
    doc.font(label==="Total"?"Helvetica-Bold":"Helvetica").text(label,350,rowY,{width:90}).text(`Rs. ${Number(value).toFixed(2)}`,440,rowY,{width:105,align:"right"});
    rowY+=20;
  }
  doc.moveDown(3).fontSize(8).font("Helvetica").text("This is a computer-generated invoice. Please retain it for your records.");
  doc.end();
}
