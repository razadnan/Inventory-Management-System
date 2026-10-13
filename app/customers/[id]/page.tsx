"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/sidebar";

type CustomerDetail = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  stats: {
    totalChallans: number;
    lifetimeTotal: number;
    lifetimeQuantity: number;
  };
  challans: {
    id: string;
    challanNumber: string;
    destination: string | null;
    createdAt: string;
    totalAmount: number;
    items: { quantity: number; product: { name: string } }[];
  }[];
};

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/customers/${params.id}`);
      const data = await res.json();
      if (data.success) setCustomer(data.customer);
      setLoading(false);
    }
    load();
  }, [params.id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100">
        <Sidebar />
        <div className="ml-64 p-8 text-slate-500">Loading...</div>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="min-h-screen bg-slate-100">
        <Sidebar />
        <div className="ml-64 p-8 text-slate-500">Customer not found.</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <Sidebar />
      <div className="ml-64 p-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{customer.name}</h1>
              <p className="mt-2 text-slate-600">
                {[customer.contactPerson, customer.phone, customer.email]
                  .filter(Boolean)
                  .join(" · ") || "No contact details on file"}
              </p>
            </div>
            <Link
              href="/customers"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              ← All Customers
            </Link>
          </div>

          {customer.address && (
            <p className="mt-2 text-sm text-slate-500">{customer.address}</p>
          )}

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Total Challans</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {customer.stats.totalChallans}
              </p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Total Quantity Taken</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {customer.stats.lifetimeQuantity}
              </p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Lifetime Amount</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                ₹{customer.stats.lifetimeTotal.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-xl bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <h2 className="font-semibold text-slate-900">Challan History</h2>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Challan #</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Products</th>
                  <th className="px-6 py-4 font-medium">Qty</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customer.challans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No challans for this customer yet.
                    </td>
                  </tr>
                ) : (
                  customer.challans.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-6 py-4 font-medium text-slate-900">{c.challanNumber}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {c.items.map((i) => i.product.name).join(", ") || "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {c.items.reduce((sum, i) => sum + i.quantity, 0)}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        ₹{c.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/challans/${c.id}`}
                          className="text-sm font-medium text-slate-600 hover:text-slate-900"
                        >
                          View
                        </Link>
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
  );
}