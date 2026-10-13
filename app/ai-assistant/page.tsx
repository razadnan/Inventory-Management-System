"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/sidebar";

type Message = {
  role: "user" | "model";
  text: string;
  pendingConfirmation?: {
    productId: string;
    productName: string;
    currentStock: number;
    requestedQuantity: number;
    reason?: string;
  } | null;
  resolved?: "confirmed" | "cancelled";
};

const SUGGESTIONS = [
  "What's low on stock?",
  "How much stock do we have today?",
  "Show recent stock movements",
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load saved chat history once, on mount. Guarded so this only ever
  // runs in the browser — sessionStorage doesn't exist during SSR.
  useEffect(() => {
    const saved = sessionStorage.getItem("ai_chat_history");
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {
        // Corrupted/old data — ignore and start fresh.
      }
    }
    setHydrated(true);
  }, []);

  // Persist on every change, after the initial load has happened —
  // otherwise this would immediately overwrite saved history with an
  // empty array on first render.
  useEffect(() => {
    if (hydrated) {
      sessionStorage.setItem("ai_chat_history", JSON.stringify(messages));
    }
  }, [messages, hydrated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const newHistory: Message[] = [...messages, { role: "user", text }];
    setMessages(newHistory);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Something went wrong");
        setLoading(false);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "model", text: data.reply, pendingConfirmation: data.pendingConfirmation },
      ]);
    } catch {
      setError("Failed to reach the AI assistant");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(index: number) {
    const message = messages[index];
    const pending = message.pendingConfirmation;
    if (!pending) return;

    setLoading(true);

    try {
      const res = await fetch("/api/ai/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: pending.productId,
          quantity: pending.requestedQuantity,
          reason: pending.reason,
        }),
      });

      const data = await res.json();

      setMessages((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], resolved: "confirmed" };
        return [
          ...updated,
          { role: "model", text: data.message || "Done." },
        ];
      });
    } catch {
      setError("Failed to confirm the action");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel(index: number) {
    setMessages((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], resolved: "cancelled" };
      return [...updated, { role: "model", text: "Cancelled. No changes were made." }];
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    sendMessage(input);
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <Sidebar />
      <div className="ml-64 flex h-screen flex-col p-8">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-slate-900">AI Assistant</h1>
            <p className="mt-2 text-slate-600">
              Ask about stock, products, movements, or customers.
            </p>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                  <p className="mb-4">Ask me anything about your warehouse.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                      message.role === "user"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.text}</p>

                    {message.pendingConfirmation && !message.resolved && (
                      <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                        <p className="text-xs font-medium text-amber-800">
                          Confirm stock removal
                        </p>
                        <p className="mt-1 text-xs text-amber-700">
                          {message.pendingConfirmation.productName}:{" "}
                          {message.pendingConfirmation.currentStock} in stock →
                          remove {message.pendingConfirmation.requestedQuantity}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleConfirm(index)}
                            disabled={loading}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => handleCancel(index)}
                            disabled={loading}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {message.pendingConfirmation && message.resolved && (
                      <p className="mt-2 text-xs italic text-slate-400">
                        {message.resolved === "confirmed" ? "Confirmed" : "Cancelled"}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-400">
                    Thinking...
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {error && (
              <div className="border-t border-red-100 bg-red-50 px-6 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="border-t border-slate-200 p-4">
              <div className="flex gap-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about stock, products, or customers..."
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}