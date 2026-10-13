import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const challan = await prisma.challan.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        items: { include: { product: true } },
        services: true,
        customer: true,
        creator: { select: { name: true } },
      },
    });

    if (!challan) {
      return NextResponse.json(
        { success: false, message: "Challan not found" },
        { status: 404 }
      );
    }

    const effectiveDestination = challan.destination || challan.customer.address || "—";

    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // Header
      doc.fontSize(18).font("Helvetica-Bold").text("Warehouse Inventory System", { align: "left" });
      doc.moveDown(0.3);
      doc.fontSize(14).font("Helvetica").text(`Delivery Challan: ${challan.challanNumber}`);
      doc.moveDown(1);

      // Meta info
      doc.fontSize(10).font("Helvetica");
      doc.text(`Date: ${challan.createdAt.toLocaleDateString()}`);
      doc.text(`Customer: ${challan.customer.name}`);
      if (challan.customer.contactPerson) doc.text(`Contact: ${challan.customer.contactPerson}`);
      if (challan.customer.phone) doc.text(`Phone: ${challan.customer.phone}`);
      doc.text(`Destination: ${effectiveDestination}`);
      if (challan.remarks) doc.text(`Remarks: ${challan.remarks}`);
      doc.text(`Issued By: ${challan.creator.name}`);
      doc.moveDown(1);

      let totalItems = 0;
      let itemsTotal = 0;

      if (challan.items.length > 0) {
        doc.fontSize(11).font("Helvetica-Bold").text("Products");
        doc.moveDown(0.3);

        const tableTop = doc.y;
        const col = { product: 50, qty: 320, price: 400, amount: 470 };

        doc.fontSize(9).font("Helvetica-Bold");
        doc.text("Product / SKU / Notes", col.product, tableTop);
        doc.text("Qty", col.qty, tableTop);
        doc.text("Price", col.price, tableTop);
        doc.text("Amount", col.amount, tableTop);

        doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

        let y = tableTop + 22;
        doc.font("Helvetica").fontSize(9);

        for (const item of challan.items) {
          const lineAmount = Number(item.unitPrice) * item.quantity;

          doc.text(`${item.product.name} (${item.product.sku})`, col.product, y, { width: 260 });
          doc.text(String(item.quantity), col.qty, y);
          doc.text(Number(item.unitPrice).toFixed(2), col.price, y);
          doc.text(lineAmount.toFixed(2), col.amount, y);

          y += 14;

          if (item.description) {
            doc.fontSize(8).fillColor("#64748b");
            doc.text(item.description, col.product, y, { width: 260 });
            doc.fillColor("black").fontSize(9);
            y += 13;
          }

          totalItems += item.quantity;
          itemsTotal += lineAmount;
          y += 8;
        }

        doc.moveTo(50, y).lineTo(545, y).stroke();
        doc.fontSize(9).font("Helvetica-Bold");
        doc.text(`Items Subtotal: Rs. ${itemsTotal.toFixed(2)}`, col.price, y + 8);

        doc.y = y + 25;
      }

      let servicesTotal = 0;

      if (challan.services.length > 0) {
        doc.moveDown(0.5);
        doc.fontSize(11).font("Helvetica-Bold").text("Services / Charges");
        doc.moveDown(0.3);

        const tableTop = doc.y;
        const col = { description: 50, amount: 470 };

        doc.fontSize(9).font("Helvetica-Bold");
        doc.text("Description", col.description, tableTop);
        doc.text("Amount", col.amount, tableTop);

        doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

        let y = tableTop + 22;
        doc.font("Helvetica").fontSize(9);

        for (const service of challan.services) {
          doc.text(service.description, col.description, y, { width: 400 });
          doc.text(Number(service.amount).toFixed(2), col.amount, y);

          servicesTotal += Number(service.amount);
          y += 18;
        }

        doc.moveTo(50, y).lineTo(545, y).stroke();
        doc.fontSize(9).font("Helvetica-Bold");
        doc.text(`Services Subtotal: Rs. ${servicesTotal.toFixed(2)}`, col.description, y + 8);

        doc.y = y + 25;
      }

      const grandTotal = itemsTotal + servicesTotal;
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica-Bold");
      if (totalItems > 0) doc.text(`Total Items: ${totalItems}`);
      doc.text(`Grand Total: Rs. ${grandTotal.toFixed(2)}`);

      doc.moveDown(3);
      doc.fontSize(10).font("Helvetica").text("_______________________", 50, doc.y);
      doc.text("Authorized Signature", 50, doc.y + 5);

      doc.end();
    });

    const filename = `${challan.challanNumber.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}