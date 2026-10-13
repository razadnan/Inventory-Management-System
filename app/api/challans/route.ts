import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

type ChallanItemInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
  description?: string;
};

type ChallanServiceInput = {
  description: string;
  amount: number;
};

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { customerId, destination, remarks, items, services } = body as {
      customerId: string;
      destination?: string;
      remarks?: string;
      items: ChallanItemInput[];
      services?: ChallanServiceInput[];
    };

    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "A customer is required" },
        { status: 400 }
      );
    }

    const hasItems = Array.isArray(items) && items.length > 0;
    const validServices = (services || []).filter(
      (s) => s.description?.trim() && typeof s.amount === "number" && s.amount >= 0
    );
    const hasServices = validServices.length > 0;

    if (!hasItems && !hasServices) {
      return NextResponse.json(
        { success: false, message: "Add at least one product or service line" },
        { status: 400 }
      );
    }

    if (hasItems) {
      for (const item of items) {
        if (
          !item.productId ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0 ||
          typeof item.unitPrice !== "number" ||
          item.unitPrice < 0
        ) {
          return NextResponse.json(
            {
              success: false,
              message: "Each item needs a valid product, positive quantity and non-negative price",
            },
            { status: 400 }
          );
        }
      }
    }

    const organizationId = user.organizationId;

    const result = await prisma.$transaction(
      async (tx) => {
        const customer = await tx.customer.findFirst({
          where: { id: customerId, organizationId },
        });

        if (!customer) {
          throw new Error("CUSTOMER_NOT_FOUND");
        }

        let productMap = new Map<string, { id: string; name: string; quantity: number }>();

        if (hasItems) {
          const products = await tx.product.findMany({
            where: {
              id: { in: items.map((i) => i.productId) },
              organizationId,
            },
          });

          productMap = new Map(products.map((p) => [p.id, p]));

          for (const item of items) {
            if (!productMap.has(item.productId)) {
              throw new Error(`PRODUCT_NOT_FOUND:${item.productId}`);
            }
          }
        }

        const year = new Date().getFullYear();
        const prefix = `CH-${year}-`;

        const existingCount = await tx.challan.count({
          where: { organizationId, challanNumber: { startsWith: prefix } },
        });

        const challanNumber = `${prefix}${String(existingCount + 1).padStart(3, "0")}`;

        const challan = await tx.challan.create({
          data: {
            organizationId,
            challanNumber,
            customerId,
            destination: destination?.trim() || null,
            remarks: remarks || null,
            createdBy: user.userId,
          },
        });

        const wentNegativeFor: string[] = [];

        if (hasItems) {
          for (const item of items) {
            const product = productMap.get(item.productId)!;
            const previousQuantity = product.quantity;
            const newQuantity = previousQuantity - item.quantity;

            if (newQuantity < 0) {
              wentNegativeFor.push(product.name);
            }

            await tx.challanItem.create({
              data: {
                challanId: challan.id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                description: item.description?.trim() || null,
              },
            });

            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: newQuantity },
            });

            await tx.stockMovement.create({
              data: {
                organizationId,
                productId: item.productId,
                movementType: "CHALLAN_OUT",
                quantity: item.quantity,
                previousQuantity,
                newQuantity,
                reference: challanNumber,
                userId: user.userId,
              },
            });
          }
        }

        if (hasServices) {
          await tx.challanService.createMany({
            data: validServices.map((s) => ({
              challanId: challan.id,
              description: s.description.trim(),
              amount: s.amount,
            })),
          });
        }

        return { challan, wentNegativeFor };
      },
      { maxWait: 15000, timeout: 15000 }
    );

    return NextResponse.json(
      {
        success: true,
        message:
          result.wentNegativeFor.length > 0
            ? `Challan created. Note: ${result.wentNegativeFor.join(", ")} now at negative stock.`
            : "Challan created successfully",
        challan: result.challan,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json(
        { success: false, message: "Customer not found" },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message.startsWith("PRODUCT_NOT_FOUND")) {
      return NextResponse.json(
        { success: false, message: "One or more products could not be found" },
        { status: 404 }
      );
    }

    console.error("Create challan error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to generate challan" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const challans = await prisma.challan.findMany({
      where: { organizationId: user.organizationId },
      include: {
        items: true,
        services: true,
        customer: { select: { name: true } },
        creator: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const withTotals = challans.map((c) => {
      const itemsTotal = c.items.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
        0
      );
      const servicesTotal = c.services.reduce((sum, s) => sum + Number(s.amount), 0);

      return { ...c, totalAmount: itemsTotal + servicesTotal };
    });

    return NextResponse.json({ success: true, challans: withTotals });
  } catch (error) {
    console.error("List challans error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch challans" },
      { status: 500 }
    );
  }
}