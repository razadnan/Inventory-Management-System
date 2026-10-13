"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar";

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    source: "PURCHASED" as "PURCHASED" | "MANUFACTURED",
    vendorName: "",
    minimumStock: "",
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/products/${params.id}`);
      const data = await res.json();

      if (data.success) {
        setFormData({
          name: data.product.name,
          sku: data.product.sku,
          category: data.product.category || "",
          source: data.product.source === "MANUFACTURED" ? "MANUFACTURED" : "PURCHASED",
          vendorName: data.product.vendorName || "",
          minimumStock: String(data.product.minimumStock),
        });
      } else {
        setError(data.message || "Failed to load product");
      }
      setFetching(false);
    }
    load();
  }, [params.id]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  }

  function handleSourceChange(source: "PURCHASED" | "MANUFACTURED") {
    setFormData((previous) => ({
      ...previous,
      source,
      vendorName: source === "MANUFACTURED" ? "" : previous.vendorName,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/products/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to update product");
      }

      router.push("/products");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <main className="min-h-screen bg-slate-100">
        <Sidebar />
        <div className="ml-64 p-8 text-slate-500">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <Sidebar />
      <div className="ml-64 p-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Edit Product</h1>
            <p className="mt-2 text-slate-600">Update product details.</p>
          </div>

          <form onSubmit={handleSubmit} className="rounded-xl bg-white p-8 shadow-sm">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Source *
              </label>
              <div className="flex gap-2 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => handleSourceChange("PURCHASED")}
                  className={`flex-1 rounded-md py-2 text-sm font-medium ${
                    formData.source === "PURCHASED"
                      ? "bg-white shadow-sm text-slate-900"
                      : "text-slate-500"
                  }`}
                >
                  Purchased (from vendor)
                </button>
                <button
                  type="button"
                  onClick={() => handleSourceChange("MANUFACTURED")}
                  className={`flex-1 rounded-md py-2 text-sm font-medium ${
                    formData.source === "MANUFACTURED"
                      ? "bg-white shadow-sm text-slate-900"
                      : "text-slate-500"
                  }`}
                >
                  Manufactured (in-house)
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Product Name *
                </label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  SKU *
                </label>
                <input
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 uppercase outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Category
                </label>
                <input
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>

              {formData.source === "PURCHASED" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Vendor Name *
                  </label>
                  <input
                    name="vendorName"
                    value={formData.vendorName}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Minimum Stock
                </label>
                <input
                  name="minimumStock"
                  type="number"
                  min="0"
                  value={formData.minimumStock}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>
            </div>

            {error && (
              <div className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push("/products")}
                className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
