"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/sidebar";

type Product = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
};

type Customer = {
  id: string;
  name: string;
  address: string | null;
};

type Row = { productId: string; quantity: string; unitPrice: string; description: string };
type ServiceRow = { description: string; amount: string };

export default function NewChallanPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [destination, setDestination] = useState("");
  const [remarks, setRemarks] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { productId: "", quantity: "", unitPrice: "", description: "" },
  ]);
  const [serviceRows, setServiceRows] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const [productsRes, customersRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/customers"),
      ]);
      const productsData = await productsRes.json();
      const customersData = await customersRes.json();
      if (productsData.success) setProducts(productsData.products);
      if (customersData.success) setCustomers(customersData.customers);
    }
    load();
  }, []);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const selectedProductIds = rows.map((r) => r.productId).filter(Boolean);
  const selectedCustomer = customers.find((c) => c.id === customerId);

  function updateRow(index: number, field: keyof Row, value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { productId: "", quantity: "", unitPrice: "", description: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateServiceRow(index: number, field: keyof ServiceRow, value: string) {
    setServiceRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function addServiceRow() {
    setServiceRows((prev) => [...prev, { description: "", amount: "" }]);
  }

  function removeServiceRow(index: number) {
    setServiceRows((prev) => prev.filter((_, i) => i !== index));
  }

  function rowBlockingIssue(row: Row, index: number): string | null {
    if (!row.productId) return null;
    const isDuplicate = rows.some((r, i) => i !== index && r.productId === row.productId);
    if (isDuplicate) return "Already added below — combine into one line instead";
    return null;
  }

  function rowStockNote(row: Row): string | null {
    const product = productMap.get(row.productId);
    const qty = Number(row.quantity);
    if (product && row.quantity && qty > product.quantity) {
      return `Only ${product.quantity} in stock — this will go negative`;
    }
    return null;
  }

  const totalQuantity = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const itemsTotal = rows.reduce(
    (sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
    0
  );
  const servicesTotal = serviceRows.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const grandTotal = itemsTotal + servicesTotal;

  const hasBlockingIssue = rows.some((row, i) => rowBlockingIssue(row, i) !== null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!customerId) {
      setError("Select a customer");
      return;
    }

    const items = rows
      .filter((r) => r.productId && r.quantity && r.unitPrice)
      .map((r) => ({
        productId: r.productId,
        quantity: Number(r.quantity),
        unitPrice: Number(r.unitPrice),
        description: r.description.trim() || undefined,
      }));

    const services = serviceRows
      .filter((s) => s.description.trim() && s.amount)
      .map((s) => ({ description: s.description.trim(), amount: Number(s.amount) }));

    if (items.length === 0 && services.length === 0) {
      setError("Add at least one product or service line");
      return;
    }

    if (hasBlockingIssue) {
      setError("Fix the highlighted product lines before submitting");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/challans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          destination: destination.trim() || undefined,
          remarks,
          items,
          services,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to create challan");
      }

      router.push(`/challans/${data.challan.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <Sidebar />
      <div className="ml-64 p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-slate-900">Create Challan</h1>
          <p className="mt-2 text-slate-600">Issue a delivery challan and deduct stock.</p>

          <form onSubmit={handleSubmit} className="mt-8 rounded-xl bg-white p-8 shadow-sm">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Customer *</label>
                  <Link
                    href="/customers/new"
                    target="_blank"
                    className="text-xs font-medium text-slate-500 hover:text-slate-900"
                  >
                    + New customer
                  </Link>
                </div>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                >
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Destination (optional)
                </label>
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder={selectedCustomer?.address || "Defaults to customer's address"}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Remarks
                </label>
                <input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </div>
            </div>

            {/* Products */}
            <div className="mt-8">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold text-slate-900">Products</h2>
                <div className="text-sm text-slate-500">
                  {totalQuantity > 0 && (
                    <span className="mr-4">
                      Qty: <strong className="text-slate-900">{totalQuantity}</strong>
                    </span>
                  )}
                  {itemsTotal > 0 && (
                    <span>
                      Subtotal: <strong className="text-slate-900">₹{itemsTotal.toFixed(2)}</strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {rows.map((row, index) => {
                  const blockingIssue = rowBlockingIssue(row, index);
                  const stockNote = rowStockNote(row);
                  const lineAmount = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);

                  return (
                    <div key={index} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex gap-3">
                        <select
                          value={row.productId}
                          onChange={(e) => updateRow(index, "productId", e.target.value)}
                          className={`flex-1 rounded-lg border px-4 py-3 text-sm outline-none focus:border-slate-500 ${
                            blockingIssue ? "border-red-300" : "border-slate-300"
                          }`}
                        >
                          <option value="">Select a product</option>
                          {products.map((p) => {
                            const usedElsewhere =
                              selectedProductIds.includes(p.id) && p.id !== row.productId;
                            return (
                              <option key={p.id} value={p.id} disabled={usedElsewhere}>
                                {p.name} ({p.sku}) — {p.quantity} in stock
                                {usedElsewhere ? " · already added" : ""}
                              </option>
                            );
                          })}
                        </select>

                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={row.quantity}
                          onChange={(e) => updateRow(index, "quantity", e.target.value)}
                          className="w-24 rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                        />

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Price"
                          value={row.unitPrice}
                          onChange={(e) => updateRow(index, "unitPrice", e.target.value)}
                          className="w-28 rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                        />

                        <div className="flex w-24 items-center justify-end text-sm text-slate-600">
                          {lineAmount > 0 ? `₹${lineAmount.toFixed(2)}` : ""}
                        </div>

                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="rounded-lg border border-slate-300 px-4 py-3 text-sm text-red-600 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Description (optional) — e.g. batch #, condition, notes"
                        value={row.description}
                        onChange={(e) => updateRow(index, "description", e.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 outline-none focus:border-slate-500"
                      />

                      {blockingIssue && <p className="mt-1 text-xs text-red-600">{blockingIssue}</p>}
                      {!blockingIssue && stockNote && (
                        <p className="mt-1 text-xs text-amber-600">{stockNote}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addRow}
                className="mt-4 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                + Add another product
              </button>
            </div>

            {/* Services */}
            <div className="mt-10 border-t border-slate-200 pt-8">
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold text-slate-900">Services / Charges</h2>
                <p className="text-xs text-slate-400">
                  Freight, installation, labour — anything not tied to a product
                </p>
              </div>

              <div className="mt-4 space-y-3">
                {serviceRows.map((service, index) => (
                  <div key={index} className="flex gap-3">
                    <input
                      type="text"
                      placeholder="e.g. Freight charges"
                      value={service.description}
                      onChange={(e) => updateServiceRow(index, "description", e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      value={service.amount}
                      onChange={(e) => updateServiceRow(index, "amount", e.target.value)}
                      className="w-32 rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeServiceRow(index)}
                      className="rounded-lg border border-slate-300 px-4 py-3 text-sm text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addServiceRow}
                className="mt-4 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                + Add a service / charge
              </button>

              {servicesTotal > 0 && (
                <p className="mt-3 text-sm text-slate-500">
                  Services subtotal: <strong className="text-slate-900">₹{servicesTotal.toFixed(2)}</strong>
                </p>
              )}
            </div>

            {grandTotal > 0 && (
              <div className="mt-6 flex justify-end border-t border-slate-200 pt-4">
                <p className="text-lg font-semibold text-slate-900">
                  Grand Total: ₹{grandTotal.toFixed(2)}
                </p>
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push("/challans")}
                className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || hasBlockingIssue}
                className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Challan"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}