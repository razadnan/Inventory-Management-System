import { GoogleGenAI } from "@google/genai";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toolDeclarations, executeReadOnlyTool } from "@/lib/ai-tools";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `You are a warehouse inventory assistant. You only know about the current organization's data, and only through the tools provided — never guess or assume numbers.

Always call a tool to answer questions about stock, products, movements, dashboard KPIs, or customers.

If the user asks to remove, reduce, issue, or dispatch stock (e.g. "remove 20 keyboards"), call request_stock_out. This does NOT execute the action — it only proposes it for the user to confirm. Never claim stock was removed unless you're told it was confirmed.

Be concise. Use ₹ for currency. If a tool returns no results, say so plainly rather than inventing an answer.`;

type ChatMessage = { role: "user" | "model"; text: string };
type GeminiPart = {
  text?: string;
  functionCall?: Record<string, unknown>;
  functionResponse?: { name: string; response: Record<string, unknown> };
};
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, message: "AI assistant is not configured. Missing GEMINI_API_KEY." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const history: ChatMessage[] = body.messages || [];

    if (history.length === 0) {
      return NextResponse.json({ success: false, message: "No message provided" }, { status: 400 });
    }

    const contents: GeminiContent[] = history.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    let pendingConfirmation: {
      productId: string;
      productName: string;
      currentStock: number;
      requestedQuantity: number;
      reason?: string;
    } | null = null;

    let finalText = "";

    // Up to 5 tool-calling round trips per message, to prevent runaway loops
    for (let turn = 0; turn < 3; turn++) {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: toolDeclarations as any }],
        },
      });

      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const functionCalls = parts
        .filter((p) => p.functionCall)
        .map((p) => p.functionCall!);
      const textParts = parts
        .filter((p) => p.text)
        .map((p) => p.text)
        .join("");

      if (textParts) finalText += textParts;

      if (functionCalls.length === 0) break;

      contents.push({ role: "model", parts: parts as GeminiPart[] });

      const functionResponseParts: {
        functionResponse: { name: string; response: Record<string, unknown> };
      }[] = [];

      for (const call of functionCalls) {
        const name = call.name || "";
        const args = (call.args || {}) as Record<string, unknown>;

        if (name === "request_stock_out") {
          const productName = String(args.productName || "");
          const quantity = Number(args.quantity || 0);
          const reason = args.reason ? String(args.reason) : undefined;

          const product = await prisma.product.findFirst({
            where: {
              organizationId: user.organizationId,
              name: { contains: productName, mode: "insensitive" },
            },
            select: { id: true, name: true, quantity: true },
          });

          if (!product) {
            functionResponseParts.push({
              functionResponse: { name, response: { error: "Product not found" } },
            });
            continue;
          }

          pendingConfirmation = {
            productId: product.id,
            productName: product.name,
            currentStock: product.quantity,
            requestedQuantity: quantity,
            reason,
          };

          functionResponseParts.push({
            functionResponse: { name, response: { status: "awaiting_user_confirmation" } },
          });
        } else {
          try {
            const result = await executeReadOnlyTool(name, args, user.organizationId);
            functionResponseParts.push({ functionResponse: { name, response: result as Record<string, unknown> } });
          } catch {
            functionResponseParts.push({
              functionResponse: { name, response: { error: "Tool execution failed" } },
            });
          }
        }
      }

      // Stop immediately once a stock-changing action is proposed —
      // don't let the model keep going as if it already happened.
      if (pendingConfirmation) break;

      contents.push({ role: "user", parts: functionResponseParts });
    }

    const reply =
      finalText ||
      (pendingConfirmation
        ? `${pendingConfirmation.productName} currently has ${pendingConfirmation.currentStock} units. You'd like to remove ${pendingConfirmation.requestedQuantity}. Please confirm below.`
        : "I couldn't find an answer to that.");

    return NextResponse.json({ success: true, reply, pendingConfirmation });
    } catch (error) {
    console.error("AI chat error:", error);

    const status = (error as { status?: number })?.status;

    if (status === 429) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The AI assistant is on Google's free tier, which allows only 5 requests per minute. Please wait about a minute and try again.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: false, message: "AI assistant failed to respond" },
      { status: 500 }
    );
  }
}