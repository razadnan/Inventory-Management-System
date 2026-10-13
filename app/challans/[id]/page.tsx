"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/sidebar";

type ChallanDetail = {
  challanNumber: string;
  destination: string | null;
  effectiveDestination: string;
  remarks: string | null;
  createdAt: string;
  totalAmount: number;
  customer: { id: string; name: string; contactPerson: string | null; phone: string | null };
  creator: { name: string };
  items: {
    id: string;
    quantity: number;
    unitPrice: string;
    description: string | null;
    product: { name: string; sku: string };
  }[];
  services: {
    id: string;
    description: string;
    amount: string;
  }[];
};

export default function ChallanDetailPage() {
  const params = useParams<{ id: string }>();
  const [challan, setChallan] = useState<ChallanDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/challans/${params.id}`);
      const data = await res.json();
      if (data.success) setChallan(data.challan);
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

  if (!challan) {
    return (
      <main className="min-h-screen bg-slate-100">
        <Sidebar />
        <div className="ml-64 p-8 text-slate-500">Challan not found.</div>
      </main>
    );
  }

  const totalItems = challan.items.reduce((sum, i) => sum + i.quantity, 0);
  const itemsTotal = challan.items.reduce(
    (sum, i) => sum + Number(i.unitPrice) * i.quantity,
    0
  );
  const servicesTotal = challan.services.reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <main className="min-h-screen bg-slate-100">
      <Sidebar />
      <div className="ml-64 p-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{challan.challanNumber}</h1>
              <p className="mt-2 text-slate-600">
                {new Date(challan.createdAt).toLocaleString()}
              </p>
            </div>

            <a
              href={`/api/challans/${params.id}/pdf`}
              className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              Download PDF
            </a>
          </div>

          <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2 text-sm">
              <div>
                <p className="text-slate-500">Customer</p>
                <p className="font-medium text-slate-900">
                  <Link
                    href={`/customers/${challan.customer.id}`}
                    className="hover:underline"
                  >
                    {challan.customer.name}
                  </Link>
                </p>
                {challan.customer.contactPerson && (
                  <p className="text-xs text-slate-500">{challan.customer.contactPerson}</p>
                )}
              </div>
              <div>
                <p className="text-slate-500">Destination</p>
                <p className="font-medium text-slate-900">{challan.effectiveDestination}</p>
              </div>
              <div>
                <p className="text-slate-500">Issued By</p>
                <p className="font-medium text-slate-900">{challan.creator.name}</p>
              </div>
              {challan.remarks && (
                <div>
                  <p className="text-slate-500">Remarks</p>
                  <p className="font-medium text-slate-900">{challan.remarks}</p>
                </div>
              )}
            </div>

            {challan.items.length > 0 && (
              <div className="mt-8">
                <h2 className="text-sm font-semibold text-slate-900">Products</h2>
                <table className="mt-3 w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-3 font-medium">Product</th>
                      <th className="py-3 font-medium">SKU</th>
                      <th className="py-3 font-medium">Qty</th>
                      <th className="py-3 font-medium">Price</th>
                      <th className="py-3 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {challan.items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-3 text-slate-900">
                          {item.product.name}
                          {item.description && (
                            <div className="mt-0.5 text-xs text-slate-400">{item.description}</div>
                          )}
                        </td>
                        <td className="py-3 text-slate-600">{item.product.sku}</td>
                        <td className="py-3 text-slate-600">{item.quantity}</td>
                        <td className="py-3 text-slate-600">
                          ₹{Number(item.unitPrice).toFixed(2)}
                        </td>
                        <td className="py-3 text-slate-600">
                          ₹{(Number(item.unitPrice) * item.quantity).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-slate-500">Total Items: {totalItems}</span>
                  <span className="font-medium text-slate-900">
                    Subtotal: ₹{itemsTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {challan.services.length > 0 && (
              <div className="mt-8">
                <h2 className="text-sm font-semibold text-slate-900">Services / Charges</h2>
                <table className="mt-3 w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-3 font-medium">Description</th>
                      <th className="py-3 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {challan.services.map((service) => (
                      <tr key={service.id} className="border-b border-slate-100">
                        <td className="py-3 text-slate-900">{service.description}</td>
                        <td className="py-3 text-slate-600">
                          ₹{Number(service.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 flex justify-end text-sm">
                  <span className="font-medium text-slate-900">
                    Subtotal: ₹{servicesTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-between border-t border-slate-200 pt-4">
              <p className="text-sm font-semibold text-slate-900">
                {challan.items.length > 0 && `Total Items: ${totalItems}`}
              </p>
              <p className="text-lg font-semibold text-slate-900">
                Grand Total: ₹{challan.totalAmount.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}