import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const organizationId = user.organizationId;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      products,
      totalChallans,
      todaysInMovements,
      todaysOutMovements,
      recentMovements,
      recentChallans,
    ] = await Promise.all([
      prisma.product.findMany({
        where: { organizationId },
        select: { quantity: true, minimumStock: true, name: true, sku: true, id: true },
      }),
      prisma.challan.count({ where: { organizationId } }),
      prisma.stockMovement.findMany({
        where: {
          organizationId,
          movementType: "STOCK_IN",
          createdAt: { gte: startOfToday },
        },
        select: { quantity: true },
      }),
      prisma.stockMovement.findMany({
        where: {
          organizationId,
          movementType: { in: ["STOCK_OUT", "CHALLAN_OUT"] },
          createdAt: { gte: startOfToday },
        },
        select: { quantity: true },
      }),
      prisma.stockMovement.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { product: { select: { name: true } } },
      }),
      prisma.challan.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          challanNumber: true,
          destination: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      }),
    ]);

    const totalProducts = products.length;
    const totalStockUnits = products.reduce((sum, p) => sum + p.quantity, 0);
    const lowStockProducts = products.filter((p) => p.quantity <= p.minimumStock);

    const stockInToday = todaysInMovements.reduce((sum, m) => sum + m.quantity, 0);
    const stockOutToday = todaysOutMovements.reduce((sum, m) => sum + m.quantity, 0);

    return NextResponse.json({
      success: true,
      stats: {
        totalProducts,
        totalStockUnits,
        lowStockCount: lowStockProducts.length,
        stockInToday,
        stockOutToday,
        totalChallans,
      },
      lowStockProducts: lowStockProducts.slice(0, 5),
      recentMovements: recentMovements.map((m) => ({
        id: m.id,
        productName: m.product.name,
        movementType: m.movementType,
        quantity: m.quantity,
        createdAt: m.createdAt,
      })),
      recentChallans: recentChallans.map((c) => ({
        id: c.id,
        challanNumber: c.challanNumber,
        customerName: c.customer.name,
        destination: c.destination,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}