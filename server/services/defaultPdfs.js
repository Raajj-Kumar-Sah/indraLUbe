import PDFDocument from "pdfkit";

const CORP_OFFICE = "905 Station Road, Ahmedabad, Gujarat – 382440";
const DIVISION = "Petrochemicals Division (Brand: IINDLUBE)";
const EMAILS = "iindlube@indiraindustries.co.in | hr@indiraindustries.co.in";
const WEBSITE = "www.indiraindustries.co.in";

export function generateDefaultCatalog(res) {
  const doc = new PDFDocument({ size: "A4", margin: 45 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="IINDLUBE-Official-Product-Catalog.pdf"');
  doc.pipe(res);

  // Header Banner
  doc.rect(45, 45, 505, 75).fill("#171714");
  doc.fillColor("#d1b477").fontSize(22).font("Helvetica-Bold").text("INDIRA INDUSTRIES", 60, 60);
  doc.fillColor("#ffffff").fontSize(11).font("Helvetica").text("PETROCHEMICALS DIVISION — IINDLUBE PRODUCT CATALOGUE", 60, 88);

  // Corporate Office Details
  doc.fillColor("#333333").fontSize(9).font("Helvetica").moveDown(3);
  doc.text(`Corporate Office: ${CORP_OFFICE}`);
  doc.text(`Division: ${DIVISION}`);
  doc.text(`Contact: ${EMAILS} | Website: ${WEBSITE}`);
  doc.moveDown(1);
  doc.strokeColor("#d1b477").lineWidth(1.5).moveTo(45, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(1.5);

  // Introduction
  doc.fillColor("#111111").fontSize(14).font("Helvetica-Bold").text("IINDLUBE High-Performance Lubrication Systems");
  doc.fontSize(9.5).font("Helvetica").fillColor("#444444").moveDown(0.5);
  doc.text(
    "IINDLUBE is the flagship petrochemicals and lubrication brand of Indira Industries. Formulated with premium synthetic base stocks and advanced thermal-stable additive packages, our lubricants deliver peak friction reduction, engine cleanliness, and component longevity in extreme operating environments."
  );
  doc.moveDown(1);

  // Product Categories
  const categories = [
    {
      name: "1. Heavy Duty Commercial Diesel Engine Oils",
      specs: "API CK-4 / CJ-4 / CI-4 Plus · SAE 15W-40, 10W-40 Synthetic Blend",
      desc: "Engineered for high-mileage commercial vehicle fleets, BS-VI diesel powertrains, turbochargers, and heavy earthmoving haulers."
    },
    {
      name: "2. Synthetic Passenger Car Motor Oils (PCMO)",
      specs: "API SP / SN Plus · ILSAC GF-6A · SAE 0W-20, 5W-30, 5W-40 Full Synthetic",
      desc: "Ultimate piston deposit protection, low-speed pre-ignition (LSPI) prevention, and maximum fuel economy for modern turbocharged engines."
    },
    {
      name: "3. Extreme-Pressure Industrial Gear Oils",
      specs: "ISO VG 150, 220, 320, 460 · AGMA 9005-E02 · DIN 51517 Part 3",
      desc: "Formulated with non-lead sulfur-phosphorus EP additives for high-load enclosed gearboxes, steel mill drives, and cement kilns."
    },
    {
      name: "4. Anti-Wear Hydraulic Fluids",
      specs: "DIN 51524 Part 2 (HLP) · ISO VG 32, 46, 68 · Parker Hannifin HF-0",
      desc: "Exceptional hydrolytic stability, rapid air release, and filterability in continuous industrial hydraulic presses and CNC systems."
    },
    {
      name: "5. High-Temperature Complex Greases",
      specs: "Lithium Complex & Polyurea NLGI 2 & 3 · Drop Point > 260°C",
      desc: "Water washout resistant grease designed for automotive wheel bearings, vibrating screens, and continuous casters."
    }
  ];

  for (const cat of categories) {
    doc.fillColor("#171714").fontSize(11).font("Helvetica-Bold").text(cat.name);
    doc.fillColor("#72582f").fontSize(8.5).font("Helvetica-Bold").text(`Standards: ${cat.specs}`);
    doc.fillColor("#555555").fontSize(9).font("Helvetica").text(cat.desc);
    doc.moveDown(0.8);
  }

  // Footer
  doc.fontSize(8).fillColor("#888888").text(
    `© ${new Date().getFullYear()} Indira Industries Petrochemicals Division. All Rights Reserved. Visit ${WEBSITE} to register as an authorized channel partner.`,
    45,
    760,
    { align: "center", width: 505 }
  );

  doc.end();
}

export function generateDefaultApplication(res) {
  const doc = new PDFDocument({ size: "A4", margin: 45 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="IINDLUBE-Distributorship-Application-Form.pdf"');
  doc.pipe(res);

  // Header Banner
  doc.rect(45, 45, 505, 75).fill("#171714");
  doc.fillColor("#d1b477").fontSize(20).font("Helvetica-Bold").text("INDIRA INDUSTRIES", 60, 58);
  doc.fillColor("#ffffff").fontSize(10.5).font("Helvetica").text("CHANNEL PARTNERSHIP & DISTRIBUTORSHIP APPLICATION FORM", 60, 85);

  doc.fillColor("#333333").fontSize(8.5).font("Helvetica").moveDown(3);
  doc.text(`Corporate Office: ${CORP_OFFICE}`);
  doc.text(`Division: ${DIVISION} | Contact: ${EMAILS}`);
  doc.moveDown(0.5);
  doc.strokeColor("#d1b477").lineWidth(1.5).moveTo(45, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(1.5);

  doc.fillColor("#111111").fontSize(12).font("Helvetica-Bold").text("Section A: Business Entity Information");
  doc.fontSize(9).font("Helvetica").fillColor("#333333").moveDown(0.5);
  doc.text("1. Registered Entity Name: __________________________________________________________________");
  doc.moveDown(0.4);
  doc.text("2. Type of Firm: [  ] Proprietorship   [  ] Partnership   [  ] Private Limited   [  ] LLP");
  doc.moveDown(0.4);
  doc.text("3. GSTIN Registration Number: ________________________   PAN: _____________________________");
  doc.moveDown(0.4);
  doc.text("4. Registered Office Address: _______________________________________________________________");
  doc.moveDown(0.4);
  doc.text("   City: ___________________________ State: _______________________ Pin Code: ______________");
  doc.moveDown(0.4);
  doc.text("5. Key Contact Person: _________________________ Designation: ____________________________");
  doc.moveDown(0.4);
  doc.text("6. Phone / Mobile: ____________________________ Email Address: ___________________________");
  doc.moveDown(1.2);

  doc.fillColor("#111111").fontSize(12).font("Helvetica-Bold").text("Section B: Commercial & Infrastructure Capacity");
  doc.fontSize(9).font("Helvetica").fillColor("#333333").moveDown(0.5);
  doc.text("1. Proposed Working Capital for IINDLUBE: [  ] ₹10-25 Lakhs   [  ] ₹25-50 Lakhs   [  ] ₹50 Lakhs+");
  doc.moveDown(0.4);
  doc.text("2. Dedicated Godown / Warehousing Area: _________ Sq. Ft.  Location: ________________________");
  doc.moveDown(0.4);
  doc.text("3. Number of Delivery Vehicles / Commercial Fleet: __________________________________________");
  doc.moveDown(0.4);
  doc.text("4. Existing Lubricants / Automotive Products Handled: _______________________________________");
  doc.moveDown(0.4);
  doc.text("5. Preferred District / Territory for Distribution: ___________________________________________");
  doc.moveDown(1.2);

  doc.fillColor("#111111").fontSize(12).font("Helvetica-Bold").text("Section C: Declaration & Signature");
  doc.fontSize(8.5).font("Helvetica").fillColor("#444444").moveDown(0.5);
  doc.text(
    "I / We hereby confirm that all information furnished above is true and authentic. I / We understand that appointment as an authorized distributor is subject to commercial verification and formal execution of the dealership agreement by Indira Industries."
  );
  doc.moveDown(2);
  doc.text("Date: ________________________                         Authorized Signatory & Rubber Stamp");
  doc.text("Place: _______________________");

  doc.fontSize(8).fillColor("#888888").text(
    `Submit this completed form along with GST, PAN & Bank Statement to: iindlube@indiraindustries.co.in`,
    45,
    760,
    { align: "center", width: 505 }
  );

  doc.end();
}

export function generateDefaultAgreement(res) {
  const doc = new PDFDocument({ size: "A4", margin: 45 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="IINDLUBE-Distributor-Agreement-Terms.pdf"');
  doc.pipe(res);

  doc.rect(45, 45, 505, 75).fill("#171714");
  doc.fillColor("#d1b477").fontSize(20).font("Helvetica-Bold").text("INDIRA INDUSTRIES", 60, 58);
  doc.fillColor("#ffffff").fontSize(10.5).font("Helvetica").text("AUTHORIZED CHANNEL PARTNER AGREEMENT TERMS", 60, 85);

  doc.fillColor("#333333").fontSize(8.5).font("Helvetica").moveDown(3);
  doc.text(`Corporate Office: ${CORP_OFFICE}`);
  doc.text(`Division: ${DIVISION} | Contact: ${EMAILS}`);
  doc.moveDown(0.5);
  doc.strokeColor("#d1b477").lineWidth(1.5).moveTo(45, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(1.5);

  const clauses = [
    {
      title: "1. Appointment & Territory",
      text: "Indira Industries appoints the Distributor on a non-exclusive / exclusive territory basis as specified in Schedule A for commercial distribution of IINDLUBE lubricants, greases and petrochemical fluids."
    },
    {
      title: "2. Pricing, Invoicing & Taxes",
      text: "Products shall be invoiced at the prevailing Distributor Price List issued periodically by Indira Industries. All statutory taxes including GST will be charged extra. Prices are subject to revision upon notification."
    },
    {
      title: "3. Minimum Stocking & Sales Targets",
      text: "The Distributor agrees to maintain adequate safety inventory of fast-moving SKUs (engine oils and hydraulic fluids) and achieve mutually agreed quarterly volume milestones."
    },
    {
      title: "4. Quality Assurance & Brand Integrity",
      text: "The Distributor shall supply products only in original sealed company packaging. Any tampering, adulteration or dilution is strictly prohibited and shall result in immediate contract termination."
    },
    {
      title: "5. Credit Terms & Payments",
      text: "Standard orders are fulfilled through authorized gateway payment (Razorpay) or company credit terms as approved in the Distributor Profile. Overdue balances attract commercial interest."
    },
    {
      title: "6. Confidentiality & Governing Jurisdiction",
      text: "All commercial pricing, technical data sheets, and dealer lists remain confidential. This agreement is governed by the laws of India and subject to the exclusive jurisdiction of Ahmedabad, Gujarat."
    }
  ];

  for (const c of clauses) {
    doc.fillColor("#171714").fontSize(11).font("Helvetica-Bold").text(c.title);
    doc.fillColor("#444444").fontSize(9).font("Helvetica").text(c.text);
    doc.moveDown(0.8);
  }

  doc.moveDown(1);
  doc.text("For Indira Industries                               For Authorized Distributor");
  doc.moveDown(2);
  doc.text("Authorized Signatory                                Authorized Signatory");

  doc.fontSize(8).fillColor("#888888").text(
    `Indira Industries Petrochemicals Division · ${CORP_OFFICE} · ${WEBSITE}`,
    45,
    760,
    { align: "center", width: 505 }
  );

  doc.end();
}
