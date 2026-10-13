import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

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
        items: {
          include: {
            product: { select: { name: true, sku: true, productCode: true } },
          },
        },
        services: true,
        customer: {
          select: { id: true, name: true, contactPerson: true, phone: true, address: true },
        },
        creator: { select: { name: true } },
      },
    });

    if (!challan) {
      return NextResponse.json(
        { success: false, message: "Challan not found" },
        { status: 404 }
      );
    }

    const itemsTotal = challan.items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0
    );
    const servicesTotal = challan.services.reduce((sum, s) => sum + Number(s.amount), 0);

    // If no delivery-specific destination was entered, fall back to the
    // customer's registered address for display purposes.
    const effectiveDestination = challan.destination || challan.customer.address || "—";

    return NextResponse.json({
      success: true,
      challan: {
        ...challan,
        effectiveDestination,
        totalAmount: itemsTotal + servicesTotal,
      },
    });
  } catch (error) {
    console.error("Get challan error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch challan" },
      { status: 500 }
    );
  }
}