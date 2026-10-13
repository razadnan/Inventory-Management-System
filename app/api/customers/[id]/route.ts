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

    const customer = await prisma.customer.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        challans: {
          orderBy: { createdAt: "desc" },
          include: {
            items: { include: { product: { select: { name: true, sku: true } } } },
            services: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 }
      );
    }

    const challansWithTotals = customer.challans.map((c) => {
      const itemsTotal = c.items.reduce(
        (sum, i) => sum + Number(i.unitPrice) * i.quantity,
        0
      );
      const servicesTotal = c.services.reduce((sum, s) => sum + Number(s.amount), 0);
      return { ...c, totalAmount: itemsTotal + servicesTotal };
    });

    const lifetimeTotal = challansWithTotals.reduce((sum, c) => sum + c.totalAmount, 0);
    const lifetimeQuantity = customer.challans.reduce(
      (sum, c) => sum + c.items.reduce((s, i) => s + i.quantity, 0),
      0
    );

    return NextResponse.json({
      success: true,
      customer: {
        ...customer,
        challans: challansWithTotals,
        stats: {
          totalChallans: challansWithTotals.length,
          lifetimeTotal,
          lifetimeQuantity,
        },
      },
    });
  } catch (error) {
    console.error("Get customer error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch customer" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const body = await request.json();
    const { name, contactPerson, phone, email, address } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, message: "Customer name is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.customer.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 }
      );
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: name.trim(),
        contactPerson: contactPerson?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        address: address?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, message: "Customer updated", customer });
  } catch (error) {
    console.error("Update customer error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update customer" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const existing = await prisma.customer.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { _count: { select: { challans: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 }
      );
    }

    if (existing._count.challans > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This customer has challan history and cannot be deleted. This preserves your transaction records.",
        },
        { status: 409 }
      );
    }

    await prisma.customer.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Customer deleted" });
  } catch (error) {
    console.error("Delete customer error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete customer" },
      { status: 500 }
    );
  }
}