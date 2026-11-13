import ExcelJS from "exceljs";
import Order from "../models/order.model.js";
import Payment from "../models/payment.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import DistributorProfile from "../models/distributorProfile.model.js";
import StockMovement from "../models/stockMovement.model.js";

function dates(query = {}) {
  const now = new Date();
  const from = query.from
    ? new Date(`${query.from}T00:00:00.000Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const to = query.to
    ? new Date(`${query.to}T23:59:59.999Z`)
    : now;

  if (!Number.isFinite(+from) || !Number.isFinite(+to) || from > to || to - from > 366 * 86400000) {
    throw Object.assign(new Error("Use a valid date range of up to 366 days"), { status: 400 });
  }
  return { from, to, range: { $gte: from, $lte: to } };
}

export async function dashboard(query = {}) {
  const { from, to, range } = dates(query);

  const [
    distributors,
    activeDistributors,
    pendingDistributors,
    ordersCount,
    paidOrders,
    pendingOrders,
    deliveredOrders,
    paymentSummary,
    allTimeRevenueSummary,
    lowStock,
    outStock,
    monthlyRevenue,
    monthlyOrders,
    distributorSales,
    productSales,
    orderStatusDistribution,
    stockMovementSummary,
    topProducts,
    recentOrders
  ] = await Promise.all([
    User.countDocuments({ role: "DISTRIBUTOR" }),
    User.countDocuments({ role: "DISTRIBUTOR", isActive: true }),
    DistributorProfile.countDocuments({ approvalStatus: "PENDING" }),
    Order.countDocuments({ createdAt: range }),
    Order.countDocuments({ paymentStatus: "PAID", createdAt: range }),
    Order.countDocuments({ orderStatus: { $in: ["PLACED", "CONFIRMED"] } }),
    Order.countDocuments({ orderStatus: "DELIVERED", createdAt: range }),
    Payment.aggregate([
      { $match: { status: "CAPTURED", capturedAt: range } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
    ]),
    Payment.aggregate([
      { $match: { status: "CAPTURED" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Product.countDocuments({ $expr: { $and: [{ $gt: ["$stockQuantity", 0] }, { $lte: ["$stockQuantity", "$reorderLevel"] }] } }),
    Product.countDocuments({ stockQuantity: 0 }),
    Payment.aggregate([
      { $match: { status: "CAPTURED", capturedAt: range } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$capturedAt", timezone: "UTC" } }, revenue: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Order.aggregate([
      { $match: { createdAt: range } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "UTC" } }, count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" } } },
      { $sort: { _id: 1 } }
    ]),
    Order.aggregate([
      { $match: { createdAt: range, paymentStatus: "PAID" } },
      { $group: { _id: "$distributorSnapshot.companyName", totalSales: { $sum: "$totalAmount" }, orderCount: { $sum: 1 } } },
      { $sort: { totalSales: -1 } },
      { $limit: 8 }
    ]),
    Order.aggregate([
      { $match: { createdAt: range, paymentStatus: "PAID" } },
      { $unwind: "$items" },
      { $group: { _id: "$items.division", grossSales: { $sum: "$items.lineTotal" }, unitsSold: { $sum: "$items.quantity" } } },
      { $sort: { grossSales: -1 } }
    ]),
    Order.aggregate([
      { $match: { createdAt: range } },
      { $group: { _id: "$orderStatus", count: { $sum: 1 } } }
    ]),
    StockMovement.aggregate([
      { $match: { createdAt: range } },
      { $group: { _id: "$type", count: { $sum: 1 }, totalQty: { $sum: "$quantity" } } }
    ]),
    Order.aggregate([
      { $match: { createdAt: range, paymentStatus: "PAID" } },
      { $unwind: "$items" },
      { $group: { _id: { sku: "$items.sku", name: "$items.name" }, quantity: { $sum: "$items.quantity" }, grossSales: { $sum: "$items.lineTotal" } } },
      { $sort: { grossSales: -1 } },
      { $limit: 10 }
    ]),
    Order.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .select("orderNumber orderStatus paymentStatus totalAmount createdAt distributorSnapshot.companyName")
      .lean()
  ]);

  return {
    period: { from, to },
    stats: {
      distributors,
      activeDistributors,
      pendingDistributors,
      orders: ordersCount,
      paidOrders,
      pendingOrders,
      deliveredOrders,
      totalRevenue: allTimeRevenueSummary[0]?.total || 0,
      collectedRevenue: paymentSummary[0]?.total || 0,
      capturedPayments: paymentSummary[0]?.count || 0,
      lowStock,
      outStock
    },
    monthly: monthlyRevenue.map(x => ({ month: x._id, revenue: x.revenue, payments: x.count })),
    monthlyOrders: monthlyOrders.map(x => ({ month: x._id, count: x.count, totalAmount: x.totalAmount })),
    distributorSales: distributorSales.map(x => ({ name: x._id || "Independent Distributor", sales: x.totalSales, orders: x.orderCount })),
    productSales: productSales.map(x => ({ division: x._id || "Other", sales: x.grossSales, units: x.unitsSold })),
    orderStatusDistribution: orderStatusDistribution.map(x => ({ status: x._id, count: x.count })),
    stockMovementSummary: stockMovementSummary.map(x => ({ type: x._id, count: x.count, totalQty: x.totalQty })),
    topProducts: topProducts.map(x => ({ sku: x._id.sku, name: x._id.name, quantity: x.quantity, grossSales: x.grossSales })),
    recentOrders
  };
}

export async function exportExcelReport(kind, query = {}) {
  const { range } = dates(query);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Indira Industries ERP";
  workbook.created = new Date();

  function styleHeader(sheet, columns) {
    sheet.columns = columns;
    const headerRow = sheet.getRow(1);
    headerRow.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF202020" }
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 28;
  }

  function styleDataRows(sheet) {
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.height = 20;
      row.font = { name: "Arial", size: 10 };
      if (rowNumber % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF7F7F7" }
        };
      }
      row.border = {
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } }
      };
    });
  }

  if (kind === "orders") {
    const filter = { createdAt: range };
    if (query.status) filter.orderStatus = query.status;
    if (query.distributor) {
      filter.$or = [
        { "distributorSnapshot.companyName": new RegExp(query.distributor, "i") },
        { "distributorSnapshot.name": new RegExp(query.distributor, "i") }
      ];
    }
    const docs = await Order.find(filter).sort({ createdAt: -1 }).limit(10000).lean();

    const sheet = workbook.addWorksheet("Orders");
    styleHeader(sheet, [
      { header: "Order ID", key: "orderNumber", width: 22 },
      { header: "Date (UTC)", key: "date", width: 20 },
      { header: "Distributor Company", key: "company", width: 28 },
      { header: "Contact Person", key: "contact", width: 22 },
      { header: "GSTIN", key: "gstin", width: 18 },
      { header: "Order Status", key: "orderStatus", width: 18 },
      { header: "Payment Status", key: "paymentStatus", width: 18 },
      { header: "Items Count", key: "itemsCount", width: 14 },
      { header: "Subtotal (₹)", key: "subtotal", width: 16 },
      { header: "Total Amount (₹)", key: "totalAmount", width: 18 }
    ]);

    for (const o of docs) {
      sheet.addRow({
        orderNumber: o.orderNumber,
        date: new Date(o.createdAt).toISOString().replace("T", " ").slice(0, 19),
        company: o.distributorSnapshot?.companyName || "—",
        contact: o.distributorSnapshot?.name || "—",
        gstin: o.distributorSnapshot?.gstin || "—",
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        itemsCount: o.items?.length || 0,
        subtotal: o.subtotal || 0,
        totalAmount: o.totalAmount || 0
      });
    }
    styleDataRows(sheet);
    return workbook.xlsx.writeBuffer();
  }

  if (kind === "payments" || kind === "sales") {
    const filter = { createdAt: range };
    if (query.status) filter.status = query.status;
    const docs = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .limit(10000)
      .populate("order", "orderNumber totalAmount distributorSnapshot")
      .lean();

    const sheet = workbook.addWorksheet("Payments & Sales");
    styleHeader(sheet, [
      { header: "Payment Ref", key: "id", width: 26 },
      { header: "Order ID", key: "orderNumber", width: 22 },
      { header: "Distributor", key: "distributor", width: 28 },
      { header: "Date (UTC)", key: "date", width: 20 },
      { header: "Provider", key: "provider", width: 14 },
      { header: "Provider Ref", key: "providerPaymentId", width: 26 },
      { header: "Status", key: "status", width: 14 },
      { header: "Amount (₹)", key: "amount", width: 16 },
      { header: "Captured At", key: "capturedAt", width: 20 }
    ]);

    for (const p of docs) {
      sheet.addRow({
        id: String(p._id),
        orderNumber: p.order?.orderNumber || "—",
        distributor: p.order?.distributorSnapshot?.companyName || "—",
        date: new Date(p.createdAt).toISOString().replace("T", " ").slice(0, 19),
        provider: p.provider,
        providerPaymentId: p.providerPaymentId || "—",
        status: p.status,
        amount: p.amount || 0,
        capturedAt: p.capturedAt ? new Date(p.capturedAt).toISOString().replace("T", " ").slice(0, 19) : "—"
      });
    }
    styleDataRows(sheet);
    return workbook.xlsx.writeBuffer();
  }

  if (kind === "inventory") {
    const filter = {};
    if (query.division) filter.division = query.division;
    if (query.status === "low") {
      filter.$expr = { $and: [{ $gt: ["$stockQuantity", 0] }, { $lte: ["$stockQuantity", "$reorderLevel"] }] };
    } else if (query.status === "out") {
      filter.stockQuantity = 0;
    }
    const docs = await Product.find(filter).sort({ sku: 1 }).limit(10000).populate("category", "name").lean();

    const sheet = workbook.addWorksheet("Inventory");
    styleHeader(sheet, [
      { header: "SKU", key: "sku", width: 16 },
      { header: "Product Name", key: "name", width: 32 },
      { header: "Division", key: "division", width: 16 },
      { header: "Category", key: "category", width: 20 },
      { header: "Brand", key: "brand", width: 18 },
      { header: "Stock Quantity", key: "stockQuantity", width: 16 },
      { header: "Reorder Threshold", key: "reorderLevel", width: 18 },
      { header: "Base Price (₹)", key: "price", width: 16 },
      { header: "Distributor Price (₹)", key: "distributorPrice", width: 20 },
      { header: "Status", key: "status", width: 14 },
      { header: "Active", key: "isActive", width: 10 }
    ]);

    for (const p of docs) {
      const stockStatus = p.stockQuantity === 0 ? "Out of Stock" : p.stockQuantity <= p.reorderLevel ? "Low Stock" : "In Stock";
      sheet.addRow({
        sku: p.sku,
        name: p.name,
        division: p.division,
        category: p.category?.name || "—",
        brand: p.brand || "—",
        stockQuantity: p.stockQuantity,
        reorderLevel: p.reorderLevel,
        price: p.price,
        distributorPrice: p.distributorPrice ?? p.price,
        status: stockStatus,
        isActive: p.isActive ? "Yes" : "No"
      });
    }
    styleDataRows(sheet);
    return workbook.xlsx.writeBuffer();
  }

  if (kind === "distributors") {
    const filter = { role: "DISTRIBUTOR" };
    if (query.active === "true") filter.isActive = true;
    if (query.active === "false") filter.isActive = false;

    const users = await User.find(filter).select("name email isActive createdAt").limit(10000).lean();
    const profiles = await DistributorProfile.find({ user: { $in: users.map(u => u._id) } }).lean();
    const map = new Map(profiles.map(p => [String(p.user), p]));

    const sheet = workbook.addWorksheet("Distributors");
    styleHeader(sheet, [
      { header: "Contact Name", key: "name", width: 22 },
      { header: "Email Address", key: "email", width: 28 },
      { header: "Company Name", key: "company", width: 30 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "GSTIN", key: "gstin", width: 18 },
      { header: "Business Type", key: "businessType", width: 18 },
      { header: "Credit Limit (₹)", key: "creditLimit", width: 16 },
      { header: "Payment Terms (Days)", key: "paymentTerms", width: 22 },
      { header: "Approval Status", key: "approvalStatus", width: 18 },
      { header: "Account Active", key: "isActive", width: 14 },
      { header: "Registered Date", key: "createdAt", width: 20 }
    ]);

    for (const u of users) {
      const p = map.get(String(u._id));
      sheet.addRow({
        name: u.name,
        email: u.email,
        company: p?.companyName || "—",
        phone: p?.phone || "—",
        gstin: p?.gstin || "—",
        businessType: p?.businessType || "—",
        creditLimit: p?.creditLimit || 0,
        paymentTerms: p?.paymentTermsDays || 0,
        approvalStatus: p?.approvalStatus || "PENDING",
        isActive: u.isActive ? "Active" : "Disabled",
        createdAt: new Date(u.createdAt).toISOString().replace("T", " ").slice(0, 19)
      });
    }
    styleDataRows(sheet);
    return workbook.xlsx.writeBuffer();
  }

  if (kind === "stock-movements") {
    const filter = { createdAt: range };
    if (query.type) filter.type = query.type;
    const docs = await StockMovement.find(filter)
      .sort({ createdAt: -1 })
      .limit(10000)
      .populate("product", "sku name")
      .lean();

    const sheet = workbook.addWorksheet("Stock Movements");
    styleHeader(sheet, [
      { header: "Timestamp (UTC)", key: "date", width: 20 },
      { header: "SKU", key: "sku", width: 16 },
      { header: "Product", key: "product", width: 30 },
      { header: "Movement Type", key: "type", width: 16 },
      { header: "Quantity", key: "quantity", width: 14 },
      { header: "Previous Balance", key: "previous", width: 18 },
      { header: "New Balance", key: "new", width: 16 },
      { header: "Reason", key: "reason", width: 24 },
      { header: "Reference", key: "reference", width: 20 }
    ]);

    for (const m of docs) {
      sheet.addRow({
        date: new Date(m.createdAt).toISOString().replace("T", " ").slice(0, 19),
        sku: m.product?.sku || "—",
        product: m.product?.name || "—",
        type: m.type,
        quantity: m.quantity,
        previous: m.previousQuantity,
        new: m.newQuantity,
        reason: m.reason || "—",
        reference: m.reference || "—"
      });
    }
    styleDataRows(sheet);
    return workbook.xlsx.writeBuffer();
  }

  throw Object.assign(new Error("Unsupported report type"), { status: 400 });
}

const csvEscape = value => {
  let s = String(value ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};
const csv = (headers, rows) => [headers.map(csvEscape).join(","), ...rows.map(row => row.map(csvEscape).join(","))].join("\r\n") + "\r\n";

export async function exportReport(kind, query = {}) {
  const { range } = dates(query);
  if (kind === "orders") {
    const docs = await Order.find({ createdAt: range }).sort({ createdAt: -1 }).limit(10000).lean();
    return csv(["Order", "Date", "Distributor", "Status", "Payment status", "Total INR"], docs.map(x => [x.orderNumber, x.createdAt.toISOString(), x.distributorSnapshot?.companyName, x.orderStatus, x.paymentStatus, x.totalAmount]));
  }
  if (kind === "payments" || kind === "sales") {
    const docs = await Payment.find({ createdAt: range }).sort({ createdAt: -1 }).limit(10000).populate("order", "orderNumber").lean();
    return csv(["Order", "Date", "Provider", "Status", "Amount INR", "Provider reference"], docs.map(x => [x.order?.orderNumber, x.createdAt.toISOString(), x.provider, x.status, x.amount, x.providerPaymentId]));
  }
  if (kind === "inventory") {
    const docs = await Product.find().sort({ sku: 1 }).limit(10000).lean();
    return csv(["SKU", "Product", "Division", "Brand", "Stock", "Reorder level", "Active"], docs.map(x => [x.sku, x.name, x.division, x.brand, x.stockQuantity, x.reorderLevel, x.isActive]));
  }
  if (kind === "distributors") {
    const users = await User.find({ role: "DISTRIBUTOR" }).select("name email isActive createdAt").limit(10000).lean();
    const profiles = await DistributorProfile.find({ user: { $in: users.map(u => u._id) } }).lean();
    const map = new Map(profiles.map(p => [String(p.user), p]));
    return csv(["Name", "Email", "Company", "GSTIN", "Approval", "Active"], users.map(u => { const p = map.get(String(u._id)); return [u.name, u.email, p?.companyName, p?.gstin, p?.approvalStatus, u.isActive]; }));
  }
  if (kind === "stock-movements") {
    const docs = await StockMovement.find({ createdAt: range }).sort({ createdAt: -1 }).limit(10000).populate("product", "sku name").lean();
    return csv(["Date", "SKU", "Type", "Quantity", "Previous", "New", "Reason", "Reference"], docs.map(x => [x.createdAt.toISOString(), x.product?.sku, x.type, x.quantity, x.previousQuantity, x.newQuantity, x.reason, x.reference]));
  }
  throw Object.assign(new Error("Unsupported report type"), { status: 400 });
}
