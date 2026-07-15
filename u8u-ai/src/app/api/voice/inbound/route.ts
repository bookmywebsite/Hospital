/**
 * Inbound Voice Call Handler
 * Receives calls from Twilio and initiates Media Streams WebSocket connection
 * Replaces old polling/Gather model with streaming architecture
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = formData.get("CallSid") as string;
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const callStatus = formData.get("CallStatus") as string;

    console.log(
      `[Inbound] Call ${callSid} from ${from} to ${to}, status: ${callStatus}`,
    );

    // Get WebSocket URL from environment
    const wsUrl = (
      process.env.VOICE_WS_SERVER_URL ||
      process.env.VOICE_AI_BASE_URL ||
      ""
    )
      .replace("https://", "wss://")
      .replace("http://", "ws://");

    if (!wsUrl) {
      console.error(
        "[Inbound] VOICE_WS_SERVER_URL or VOICE_AI_BASE_URL not configured",
      );
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>We are experiencing technical difficulties. Please try again later.</Say>
          <Hangup/>
        </Response>`;
      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Get default agent (or find agent for this number)
    const agent = await prisma.voiceAgent.findFirst({
      where: { isActive: true },
    });

    if (!agent) {
      console.error("[Inbound] No active agent found");
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say>Our agents are currently unavailable. Please try again later.</Say>
          <Hangup/>
        </Response>`;
      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Create conversation record for this call
    const conversation = await prisma.conversation.create({
      data: {
        organizationId: agent.organizationId || "default",
        agentId: agent.id,
        channel: "VOICE",
        status: "ACTIVE",
        twilioCallSid: callSid,
        callDirection: "INBOUND",
        phoneFrom: from,
      },
    });

    // Build custom parameters for WebSocket
    // NOTE: language is intentionally NOT set here for inbound calls.
    // The websocket-handler auto-detects the caller's language from their
    // first utterance (Unicode range detection) and locks it after 2
    // consistent detections. Hardcoding agent.language would force
    // English on every caller regardless of what they speak.
    const params = new URLSearchParams({
      streamSid: "will-be-provided-by-twilio",
      callSid,
      conversationId: conversation.id,
      agentId: agent.id,
      from,
      to,
      direction: "inbound",
    });

    // Return TwiML that connects to Media Streams WebSocket
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Connect>
          <Stream url="${wsUrl}/api/voice/stream?${params.toString()}">
            <Parameter name="StreamSid" value="{{StreamSid}}" />
            <Parameter name="CallSid" value="${callSid}" />
            <Parameter name="conversationId" value="${conversation.id}" />
            <Parameter name="agentId" value="${agent.id}" />
            <Parameter name="direction" value="inbound" />
          </Stream>
        </Connect>
      </Response>`;

    console.log(
      `[Inbound] Connecting call ${callSid} to WebSocket at ${wsUrl}`,
    );

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error: any) {
    console.error("[Inbound] Error:", error);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>An error occurred. Please try again.</Say>
        <Hangup/>
      </Response>`;
    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
      status: 500,
    });
  }
}
