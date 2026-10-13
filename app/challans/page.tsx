"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";

type Challan = {
  id: string;
  challanNumber: string;
  destination: string | null;
  createdAt: string;
  items: { quantity: number }[];
  customer: { name: string };
  creator: { name: string };
  totalAmount: number;
};

export default function ChallansPage() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/challans");
      const data = await res.json();
      if (data.success) setChallans(data.challans);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100">
      <Sidebar />
      <div className="ml-64 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Challans</h1>
              <p className="mt-2 text-slate-600">Delivery challans and stock issues.</p>
            </div>
            <Link
              href="/challans/new"
              className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              + Create Challan
            </Link>
          </div>

          <div className="mt-8 rounded-xl bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Challan #</th>
                  <th className="px-6 py-4 font-medium">Customer</th>
                  <th className="px-6 py-4 font-medium">Items</th>
                  <th className="px-6 py-4 font-medium">Total</th>
                  <th className="px-6 py-4 font-medium">Issued By</th>
                  <th className="px-6 py-4 font-medium">Date</th>
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
                ) : challans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No challans yet.
                    </td>
                  </tr>
                ) : (
                  challans.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-6 py-4 font-medium text-slate-900">{c.challanNumber}</td>
                      <td className="px-6 py-4 text-slate-600">{c.customer.name}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {c.items.reduce((sum, i) => sum + i.quantity, 0)}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        ₹{c.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{c.creator.name}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-3">
                          <Link
                            href={`/challans/${c.id}`}
                            className="text-sm font-medium text-slate-600 hover:text-slate-900"
                          >
                            View
                          </Link>
                          <a
                            href={`/api/challans/${c.id}/pdf`}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800"
                          >
                            PDF
                          </a>
                        </div>
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