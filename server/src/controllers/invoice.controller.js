import * as service from "../services/invoice.service.js";
import { streamInvoicePdf } from "../services/invoice.pdf.js";

export async function downloadByOrder(req, res, next) {
  try {
    const invoice = await service.getInvoiceForOrder(req.params.orderId, req.user);
    streamInvoicePdf(invoice, res);
  } catch (e) {
    next(e);
  }
}

export async function downloadById(req, res, next) {
  try {
    const invoice = await service.getInvoiceForUser(req.params.invoiceId, req.user);
    streamInvoicePdf(invoice, res);
  } catch (e) {
    next(e);
  }
}
