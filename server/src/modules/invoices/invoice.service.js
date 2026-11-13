import crypto from "node:crypto";
import Invoice from "./invoice.model.js";
import Order from "../orders/order.model.js";

const invoiceNo=()=>`IND-INV-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

export async function createInvoiceForPaidOrder(order,paymentId){
  const existing=await Invoice.findOne({order:order._id});
  if(existing)return existing;
  try {
    return await Invoice.create({
      invoiceNumber:invoiceNo(),order:order._id,distributor:order.distributor,
      billTo:order.distributorSnapshot,items:order.items.map(i=>({
        sku:i.sku,name:i.name,quantity:i.quantity,unitPrice:i.unitPrice,lineTotal:i.lineTotal
      })),
      subtotal:order.subtotal,taxAmount:order.taxAmount,shippingAmount:order.shippingAmount,
      totalAmount:order.totalAmount,currency:order.currency,paymentReference:paymentId
    });
  } catch(error) {
    if(error.code===11000)return Invoice.findOne({order:order._id});
    throw error;
  }
}

export async function getInvoiceForUser(invoiceId,user){
  const filter={_id:invoiceId};
  if(user.role==="DISTRIBUTOR")filter.distributor=user.sub;
  const invoice=await Invoice.findOne(filter).lean();
  if(!invoice)throw Object.assign(new Error("Invoice not found"),{status:404});
  return invoice;
}
export async function getInvoiceForOrder(orderId,user){
  const filter={_id:orderId};
  if(user.role==="DISTRIBUTOR")filter.distributor=user.sub;
  const order=await Order.findOne(filter);
  if(!order)throw Object.assign(new Error("Order not found"),{status:404});
  const invoice=await Invoice.findOne({order:order._id}).lean();
  if(!invoice)throw Object.assign(new Error("Invoice is not available until payment is confirmed"),{status:404});
  return invoice;
}
