import { Type } from "@google/genai";
import { prisma } from "@/lib/prisma";

// Every tool function receives organizationId as its first argument,
// derived server-side from the authenticated session — never from the
// AI or the request body. This is the core safety rule from SRS
// Section 22: "The organization ID should preferably be derived from
// the authenticated session rather than supplied directly by the AI."

export const toolDeclarations = [
  {
    name: "get_product_stock",
    description: "Get current stock quantity, SKU, and minimum stock level for a product by name or partial name match.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        productName: { type: Type.STRING, description: "Product name or partial name to search for" },
      },
      required: ["productName"],
    },
  },
  {
    name: "search_products",
    description: "Search for products by name, SKU, or category. Returns a list of matching products with stock levels.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: "Search term" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_low_stock_products",
    description: "Get all products that are at or below their minimum stock level, including any with negative (backorder) stock.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "get_stock_movements",
    description: "Get recent stock movement history (IN, OUT, CHALLAN_OUT), optionally filtered by product name or number of days back.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        productName: { type: Type.STRING, description: "Optional product name to filter by" },
        days: { type: Type.NUMBER, description: "Optional number of days to look back (default 30)" },
      },
    },
  },
  {
    name: "get_dashboard_summary",
    description: "Get overall warehouse KPIs: total products, total stock units, low stock count, today's stock IN/OUT, total challans.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "get_customer_summary",
    description: "Get a customer's order history: total challans, lifetime quantity taken, lifetime amount spent.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerName: { type: Type.STRING, description: "Customer or dealer name to search for" },
      },
      required: ["customerName"],
    },
  },
  {
    name: "request_stock_out",
    description: "Propose removing stock from a product (Stock OUT). This does NOT execute immediately — it requires explicit user confirmation before the actual deduction happens.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        productName: { type: Type.STRING, description: "Product name to remove stock from" },
        quantity: { type: Type.NUMBER, description: "Quantity to remove" },
        reason: { type: Type.STRING, description: "Optional reason or reference for this stock removal" },
      },
      required: ["productName", "quantity"],
    },
  },
];

// --- Read-only tool executors ---
// These run immediately when the AI calls them — safe, since they only
// ever read data already scoped to organizationId.

export async function executeReadOnlyTool(
  name: string,
  args: Record<string, unknown>,
  organizationId: string
): Promise<unknown> {
  switch (name) {
    case "get_product_stock": {
      const productName = String(args.productName || "");
      const products = await prisma.product.findMany({
        where: {
          organizationId,
          name: { contains: productName, mode: "insensitive" },
        },
        select: { name: true, sku: true, quantity: true, minimumStock: true, category: true },
        take: 5,
      });
      if (products.length === 0) return { found: false, message: "No matching product found" };
      return { found: true, products };
    }

    case "search_products": {
      const query = String(args.query || "");
      const products = await prisma.product.findMany({
        where: {
          organizationId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } },
            { category: { contains: query, mode: "insensitive" } },
          ],
        },
        select: { name: true, sku: true, category: true, quantity: true, minimumStock: true },
        take: 10,
      });
      return { count: products.length, products };
    }

    case "get_low_stock_products": {
      const products = await prisma.product.findMany({
        where: { organizationId },
        select: { name: true, sku: true, quantity: true, minimumStock: true },
      });
      const lowStock = products.filter((p) => p.quantity <= p.minimumStock);
      return { count: lowStock.length, products: lowStock };
    }

    case "get_stock_movements": {
      const productName = args.productName ? String(args.productName) : undefined;
      const days = args.days ? Number(args.days) : 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const movements = await prisma.stockMovement.findMany({
        where: {
          organizationId,
          createdAt: { gte: since },
          ...(productName
            ? { product: { name: { contains: productName, mode: "insensitive" } } }
            : {}),
        },
        include: { product: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      return {
        count: movements.length,
        movements: movements.map((m) => ({
          product: m.product.name,
          type: m.movementType,
          quantity: m.quantity,
          previousQuantity: m.previousQuantity,
          newQuantity: m.newQuantity,
          date: m.createdAt.toISOString().split("T")[0],
        })),
      };
    }

    case "get_dashboard_summary": {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [products, totalChallans, inToday, outToday] = await Promise.all([
        prisma.product.findMany({
          where: { organizationId },
          select: { quantity: true, minimumStock: true },
        }),
        prisma.challan.count({ where: { organizationId } }),
        prisma.stockMovement.findMany({
          where: { organizationId, movementType: "STOCK_IN", createdAt: { gte: startOfToday } },
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
      ]);

      return {
        totalProducts: products.length,
        totalStockUnits: products.reduce((s, p) => s + p.quantity, 0),
        lowStockCount: products.filter((p) => p.quantity <= p.minimumStock).length,
        stockInToday: inToday.reduce((s, m) => s + m.quantity, 0),
        stockOutToday: outToday.reduce((s, m) => s + m.quantity, 0),
        totalChallans,
      };
    }

    case "get_customer_summary": {
      const customerName = String(args.customerName || "");
      const customer = await prisma.customer.findFirst({
        where: { organizationId, name: { contains: customerName, mode: "insensitive" } },
        include: {
          challans: {
            include: { items: true, services: true },
          },
        },
      });

      if (!customer) return { found: false, message: "No matching customer found" };

      const lifetimeTotal = customer.challans.reduce((sum, c) => {
        const itemsTotal = c.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
        const servicesTotal = c.services.reduce((s, sv) => s + Number(sv.amount), 0);
        return sum + itemsTotal + servicesTotal;
      }, 0);

      const lifetimeQuantity = customer.challans.reduce(
        (sum, c) => sum + c.items.reduce((s, i) => s + i.quantity, 0),
        0
      );

      return {
        found: true,
        name: customer.name,
        totalChallans: customer.challans.length,
        lifetimeQuantity,
        lifetimeTotal,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}