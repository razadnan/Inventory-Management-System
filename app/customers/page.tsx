"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";

type Customer = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  _count: { challans: number };
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchCustomers = useCallback(async (query: string) => {
    setLoading(true);
    const res = await fetch(`/api/customers?search=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data.success) setCustomers(data.customers);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => fetchCustomers(search), 300);
    return () => clearTimeout(timeout);
  }, [search, fetchCustomers]);

  return (
    <main className="min-h-screen bg-slate-100">
      <Sidebar />
      <div className="ml-64 p-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Customers / Dealers</h1>
              <p className="mt-2 text-slate-600">
                Track dealers and customers you supply to.
              </p>
            </div>
            <Link
              href="/customers/new"
              className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              + Add Customer
            </Link>
          </div>

          <div className="mt-8 rounded-xl bg-white shadow-sm">
            <div className="border-b border-slate-200 p-6">
              <input
                type="text"
                placeholder="Search by name, contact or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-sm rounded-lg border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Contact Person</th>
                  <th className="px-6 py-4 font-medium">Phone</th>
                  <th className="px-6 py-4 font-medium">Challans</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No customers yet.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-6 py-4 font-medium text-slate-900">{c.name}</td>
                      <td className="px-6 py-4 text-slate-600">{c.contactPerson || "—"}</td>
                      <td className="px-6 py-4 text-slate-600">{c.phone || "—"}</td>
                      <td className="px-6 py-4 text-slate-600">{c._count.challans}</td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/customers/${c.id}`}
                          className="text-sm font-medium text-slate-600 hover:text-slate-900"
                        >
                          View History
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