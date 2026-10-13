import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const categoryCodes: Record<string, string> = {
  sensor: "S",
  component: "C",
  mechanical: "M",
  electronics: "E",
  electrical: "EL",
};

function getCategoryCode(category: string) {
  const normalized = category.trim().toLowerCase();
  return categoryCodes[normalized] || "O";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, sku, category, source, vendorName, quantity, minimumStock } = body;

    if (!name || !sku || !category) {
      return NextResponse.json(
        { message: "Name, SKU and category are required" },
        { status: 400 }
      );
    }

    const normalizedSource = source === "MANUFACTURED" ? "MANUFACTURED" : "PURCHASED";

    if (normalizedSource === "PURCHASED" && !vendorName?.trim()) {
      return NextResponse.json(
        { message: "Vendor name is required for purchased products" },
        { status: 400 }
      );
    }

    const normalizedSku = sku.toUpperCase();

    const existingProduct = await prisma.product.findUnique({
      where: {
        organizationId_sku: {
          organizationId: user.organizationId,
          sku: normalizedSku,
        },
      },
    });

    if (existingProduct) {
      return NextResponse.json(
        { message: "A product with this SKU already exists in your organization" },
        { status: 409 }
      );
    }

    const categoryCode = getCategoryCode(category);
    const prefix = `MI01/${categoryCode}/`;

    const products = await prisma.product.findMany({
      where: {
        organizationId: user.organizationId,
        productCode: { startsWith: prefix },
      },
      select: { productCode: true },
    });

    let highestSequence = 0;
    for (const product of products) {
      const parts = product.productCode.split("/");
      const sequence = Number(parts[2]);
      if (!Number.isNaN(sequence) && sequence > highestSequence) {
        highestSequence = sequence;
      }
    }

    const productCode = `${prefix}${highestSequence + 1}`;

    const product = await prisma.product.create({
      data: {
        organizationId: user.organizationId,
        productCode,
        name,
        sku: normalizedSku,
        category,
        source: normalizedSource,
        vendorName: normalizedSource === "PURCHASED" ? vendorName.trim() : null,
        quantity: Number(quantity || 0),
        minimumStock: Number(minimumStock || 0),
      },
    });

    return NextResponse.json(
      { message: "Product created successfully", product },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json(
      { message: "Failed to create product" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const lowStockOnly = searchParams.get("lowStock") === "true";

    const products = await prisma.product.findMany({
      where: {
        organizationId: user.organizationId,
        AND: [
          search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { sku: { contains: search, mode: "insensitive" } },
                  { productCode: { contains: search, mode: "insensitive" } },
                  { vendorName: { contains: search, mode: "insensitive" } },
                ],
              }
            : {},
          category ? { category } : {},
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    const filtered = lowStockOnly
      ? products.filter((p) => p.quantity <= p.minimumStock)
      : products;

    return NextResponse.json({ success: true, products: filtered });
  } catch (error) {
    console.error("List products error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch products" },
      { status: 500 }
    );
  }
}