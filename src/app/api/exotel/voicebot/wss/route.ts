import { NextRequest, NextResponse } from "next/server";

function resolveBaseWsUrl(): string {
  const configured = (
    process.env.VOICE_WS_SERVER_URL ||
    process.env.VOICE_AI_BASE_URL ||
    ""
  ).trim();
  if (!configured) {
    throw new Error(
      "VOICE_WS_SERVER_URL or VOICE_AI_BASE_URL is not configured",
    );
  }
  return configured
    .replace("https://", "wss://")
    .replace("http://", "ws://")
    .replace(/\/$/, "");
}

// Exotel calls this URL to get the WebSocket URL for the voice bot.
// CRITICAL: all query params (language, agentId, leadId, …) MUST be
// forwarded to the WebSocket URL — Exotel sends them back as customParameters
// which websocket-handler.ts reads as params.language etc.
function buildWsUrl(request: NextRequest): string {
  const baseUrl = resolveBaseWsUrl();
  const incoming = request.nextUrl.searchParams;
  const outgoing = new URLSearchParams();

  outgoing.set("sample-rate", "8000");

  // Forward every context param the outbound call embedded in this URL
  const FORWARD = [
    "language",
    "agentId",
    "leadId",
    "patientId",
    "orgId",
    "callType",
    "purpose",
    "transferType",
    "intent",
    "department",
  ];
  for (const key of FORWARD) {
    const val = incoming.get(key);
    if (val) outgoing.set(key, val);
  }

  return `${baseUrl}/media?${outgoing.toString()}`;
}

export async function GET(request: NextRequest) {
  try {
    const wsUrl = buildWsUrl(request);
    console.log("[Exotel WSS] WebSocket URL:", wsUrl);
    return new NextResponse(wsUrl, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error: any) {
    console.error("[Exotel WSS] Error:", error);
    return new NextResponse(error?.message || "Failed to build websocket URL", {
      status: 500,
    });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
