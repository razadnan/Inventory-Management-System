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

    const product = await prisma.product.findFirst({
      where: { id, organizationId: user.organizationId },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("Get product error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch product" },
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

    const { name, sku, category, source, vendorName, minimumStock } = body;

    if (!name || !sku || !category) {
      return NextResponse.json(
        { success: false, message: "Name, SKU and category are required" },
        { status: 400 }
      );
    }

    const normalizedSource = source === "MANUFACTURED" ? "MANUFACTURED" : "PURCHASED";

    if (normalizedSource === "PURCHASED" && !vendorName?.trim()) {
      return NextResponse.json(
        { success: false, message: "Vendor name is required for purchased products" },
        { status: 400 }
      );
    }

    if (Number(minimumStock) < 0) {
      return NextResponse.json(
        { success: false, message: "Minimum stock must be positive" },
        { status: 400 }
      );
    }

    const existing = await prisma.product.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    const normalizedSku = sku.toUpperCase();

    const skuOwner = await prisma.product.findUnique({
      where: {
        organizationId_sku: {
          organizationId: user.organizationId,
          sku: normalizedSku,
        },
      },
    });
    if (skuOwner && skuOwner.id !== id) {
      return NextResponse.json(
        { success: false, message: "A different product already uses this SKU" },
        { status: 409 }
      );
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        sku: normalizedSku,
        category,
        source: normalizedSource,
        vendorName: normalizedSource === "PURCHASED" ? vendorName.trim() : null,
        minimumStock: Number(minimumStock || 0),
      },
    });

    return NextResponse.json({ success: true, message: "Product updated", product });
  } catch (error) {
    console.error("Update product error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update product" },
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

    const existing = await prisma.product.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    await prisma.product.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Product deleted" });
  } catch (error) {
    console.error("Delete product error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete product" },
      { status: 500 }
    );
  }
}