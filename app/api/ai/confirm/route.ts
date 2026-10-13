import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

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
    const { productId, quantity, reason } = body;

    if (!productId || !quantity) {
      return NextResponse.json(
        { success: false, message: "Product and quantity are required" },
        { status: 400 }
      );
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json(
        { success: false, message: "Quantity must be a positive whole number" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        // Re-verify the product belongs to this org at execution time —
        // never trust that the ID handed back from the earlier AI turn
        // is still valid or still this user's. Same 404-not-403 pattern
        // as every other org-scoped route.
        const product = await tx.product.findFirst({
          where: { id: productId, organizationId: user.organizationId },
        });

        if (!product) {
          throw new Error("PRODUCT_NOT_FOUND");
        }

        const previousQuantity = product.quantity;
        const newQuantity = previousQuantity - qty;

        const updatedProduct = await tx.product.update({
          where: { id: productId },
          data: { quantity: newQuantity },
        });

        const movement = await tx.stockMovement.create({
          data: {
            organizationId: user.organizationId,
            productId,
            movementType: "STOCK_OUT",
            quantity: qty,
            previousQuantity,
            newQuantity,
            reference: reason ? `AI Assistant: ${reason}` : "AI Assistant",
            userId: user.userId,
          },
        });

        return { updatedProduct, movement };
      },
      { maxWait: 15000, timeout: 15000 }
    );

    const wentNegative = result.updatedProduct.quantity < 0;

    return NextResponse.json({
      success: true,
      message: wentNegative
        ? `Confirmed. ${result.updatedProduct.name} is now at ${result.updatedProduct.quantity} (negative stock).`
        : `Confirmed. ${result.updatedProduct.name} is now at ${result.updatedProduct.quantity} units.`,
      product: result.updatedProduct,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    console.error("AI confirm error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to execute stock change" },
      { status: 500 }
    );
  }
}