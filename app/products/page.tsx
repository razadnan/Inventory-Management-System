"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/sidebar";

type Product = {
  id: string;
  productCode: string;
  name: string;
  sku: string;
  category: string | null;
  source: "PURCHASED" | "MANUFACTURED";
  vendorName: string | null;
  quantity: number;
  minimumStock: number;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async (query: string) => {
    setLoading(true);
    const res = await fetch(`/api/products?search=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data.success) setProducts(data.products);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => fetchProducts(search), 300);
    return () => clearTimeout(timeout);
  }, [search, fetchProducts]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this product? This cannot be undone.")) return;

    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Failed to delete product");
      return;
    }

    fetchProducts(search);
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <Sidebar />
      <div className="ml-64 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Products</h1>
              <p className="mt-2 text-slate-600">
                Manage your warehouse products and inventory.
              </p>
            </div>

            <Link
              href="/products/new"
              className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              + Add Product
            </Link>
          </div>

          <div className="mt-8 rounded-xl bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Product Inventory</h2>

                <input
                  type="text"
                  placeholder="Search by name, SKU or vendor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">Product</th>
                    <th className="px-6 py-4 font-medium">SKU</th>
                    <th className="px-6 py-4 font-medium">Category</th>
                    <th className="px-6 py-4 font-medium">Vendor</th>
                    <th className="px-6 py-4 font-medium">Stock</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        Loading...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        No products found.
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => {
                      const isNegative = product.quantity < 0;
                      const isLow = product.quantity <= product.minimumStock;

                      return (
                        <tr key={product.id} className="border-t border-slate-100">
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">{product.name}</div>
                            <div className="text-xs text-slate-400">{product.productCode}</div>
                          </td>
                          <td className="px-6 py-4 text-slate-600">{product.sku}</td>
                          <td className="px-6 py-4 text-slate-600">{product.category || "—"}</td>
                          <td className="px-6 py-4">
                            {product.source === "MANUFACTURED" ? (
                              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                                In-house
                              </span>
                            ) : (
                              <span className="text-slate-600">{product.vendorName}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-600">{product.quantity}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                isNegative
                                  ? "bg-orange-100 text-orange-800"
                                  : isLow
                                  ? "bg-red-100 text-red-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {isNegative ? "Backorder" : isLow ? "Low Stock" : "In Stock"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-3">
                              <Link
                                href={`/products/${product.id}/edit`}
                                className="text-sm font-medium text-slate-600 hover:text-slate-900"
                              >
                                Edit
                              </Link>
                              <button
                                onClick={() => handleDelete(product.id)}
                                className="text-sm font-medium text-red-600 hover:text-red-800"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}