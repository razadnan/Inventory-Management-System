"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  status: string;
  createdAt: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userLimit, setUserLimit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    const res = await fetch("/api/users");
    const data = await res.json();

    if (!data.success) {
      setError(data.message || "Failed to load users");
      setLoading(false);
      return;
    }

    setUsers(data.users);
    setUserLimit(data.userLimit);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this user? They will no longer be able to log in.")) return;

    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Failed to deactivate user");
      return;
    }

    fetchUsers();
  }

  async function handleReactivate(id: string) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    const data = await res.json();

    if (!data.success) {
      alert(data.message || "Failed to reactivate user");
      return;
    }

    fetchUsers();
  }

  const availableSlots = Math.max(userLimit - users.length, 0);
  const atLimit = users.length >= userLimit;

  return (
    <main className="min-h-screen bg-slate-100">
      <Sidebar />
      <div className="ml-64 p-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
              <p className="mt-2 text-slate-600">
                Manage the users in your organization.
              </p>
            </div>

            <Link
              href="/users/create"
              className={`rounded-lg px-5 py-3 text-sm font-medium text-white ${
                atLimit
                  ? "pointer-events-none bg-slate-300"
                  : "bg-slate-900 hover:bg-slate-800"
              }`}
            >
              + Create User
            </Link>
          </div>

          <div className="mt-6 flex gap-4 text-sm text-slate-600">
            <span className="rounded-lg bg-white px-4 py-2 shadow-sm">
              Users: <strong className="text-slate-900">{users.length} / {userLimit}</strong>
            </span>
            <span className="rounded-lg bg-white px-4 py-2 shadow-sm">
              Available Slots: <strong className="text-slate-900">{availableSlots}</strong>
            </span>
          </div>

          {atLimit && (
            <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
              User limit reached. Deactivate an existing user or increase the organization user limit to add more.
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="mt-6 rounded-xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Email</th>
                    <th className="px-6 py-4 font-medium">Role</th>
                    <th className="px-6 py-4 font-medium">Status</th>
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
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="border-t border-slate-100">
                        <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
                        <td className="px-6 py-4 text-slate-600">{u.email}</td>
                        <td className="px-6 py-4 text-slate-600">{u.role}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              u.status === "ACTIVE"
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {u.status === "ACTIVE" ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {u.status === "ACTIVE" ? (
                            <button
                              onClick={() => handleDeactivate(u.id)}
                              className="text-sm font-medium text-red-600 hover:text-red-800"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(u.id)}
                              className="text-sm font-medium text-green-600 hover:text-green-800"
                            >
                              Reactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
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