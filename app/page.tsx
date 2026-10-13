import Sidebar from "@/components/sidebar";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
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
  ] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId },
      select: { id: true, name: true, quantity: true, minimumStock: true },
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
  ]);

  const totalProducts = products.length;
  const totalStockUnits = products.reduce((sum, p) => sum + p.quantity, 0);
  const lowStockProducts = products.filter((p) => p.quantity <= p.minimumStock);
  const stockInToday = todaysInMovements.reduce((sum, m) => sum + m.quantity, 0);
  const stockOutToday = todaysOutMovements.reduce((sum, m) => sum + m.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar />

      <main className="ml-64 p-8">
        <div className="mx-auto max-w-7xl">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="mt-2 text-slate-600">Overview of your warehouse inventory</p>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Total Products</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{totalProducts}</p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Total Stock</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{totalStockUnits}</p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Low Stock</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {lowStockProducts.length}
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Total Challans</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{totalChallans}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Stock IN Today</p>
              <p className="mt-2 text-2xl font-bold text-green-700">+{stockInToday}</p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Stock OUT Today</p>
              <p className="mt-2 text-2xl font-bold text-orange-700">-{stockOutToday}</p>
            </div>
          </div>

          {lowStockProducts.length > 0 && (
            <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900">Low Stock Products</h2>
              <ul className="mt-4 divide-y divide-slate-100">
                {lowStockProducts.map((p) => (
                  <li key={p.id} className="flex justify-between py-3 text-sm">
                    <span className="text-slate-700">{p.name}</span>
                    <span className="text-red-600">
                      {p.quantity} left (min {p.minimumStock})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 rounded-xl bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <h2 className="font-semibold text-slate-900">Recent Movements</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Product</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Qty</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMovements.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        No movements yet.
                      </td>
                    </tr>
                  ) : (
                    recentMovements.map((m) => (
                      <tr key={m.id} className="border-t border-slate-100">
                        <td className="px-6 py-3 text-slate-900">{m.product.name}</td>
                        <td className="px-6 py-3 text-slate-600">{m.movementType}</td>
                        <td className="px-6 py-3 text-slate-600">{m.quantity}</td>
                        <td className="px-6 py-3 text-slate-500">
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}