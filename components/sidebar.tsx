"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SessionInfo = {
  name: string;
  role: string;
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setSession({ name: data.user.name, role: data.user.role });
      })
      .catch(() => {});
  }, []);

  const isAdmin = session?.role === "ADMIN";

  const navigation = [
    { name: "Dashboard", href: "/", icon: "▦" },
    { name: "Products", href: "/products", icon: "📦" },
    { name: "Stock", href: "/stock", icon: "↕" },
    { name: "Challans", href: "/challans", icon: "📄" },
    { name: "Customers", href: "/customers", icon: "🧑‍💼" },
    ...(isAdmin ? [{ name: "Users", href: "/users", icon: "👥" }] : []),
    { name: "AI Assistant", href: "/ai-assistant", icon: "✦" },
  ];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    sessionStorage.removeItem("ai_chat_history");
    window.location.href = "/login";
  }

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col bg-slate-900 text-white">
      <div className="border-b border-slate-700 px-6 py-5">
        <h1 className="text-xl font-bold">Inventory</h1>
        <p className="mt-1 text-xs text-slate-400">Warehouse Management</p>
      </div>

      <nav className="flex-1 space-y-2 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                isActive
                  ? "bg-white text-slate-900"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="w-5 text-center">{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-700 p-4">
        <div className="rounded-lg bg-slate-800 p-3">
          <p className="text-sm font-medium">{session?.name || "..."}</p>
          <p className="mt-1 text-xs text-slate-400">
            {session?.role === "ADMIN" ? "Administrator" : "Warehouse User"}
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}