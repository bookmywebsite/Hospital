import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { makeOutboundCall } from "@/lib/communications";
import { formatPhoneE164 } from "@/lib/twilio";

function badRequest(message: string, code = "BAD_REQUEST") {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
      retryable: false,
    },
    { status: 400 },
  );
}

function inferErrorStatus(message: string): number {
  const lower = message.toLowerCase();
  if (
    lower.includes("unauthorized") ||
    lower.includes("authentication") ||
    lower.includes("401") ||
    lower.includes("34010")
  ) {
    return 401;
  }
  if (lower.includes("not found")) return 404;
  if (
    lower.includes("required") ||
    lower.includes("invalid") ||
    lower.includes("cannot reach localhost")
  )
    return 400;
  if (
    lower.includes("timeout") ||
    lower.includes("temporarily") ||
    lower.includes("unavailable")
  )
    return 503;
  return 502;
}

function getUserFacingError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("34010") ||
    lower.includes("authentication") ||
    lower.includes("401")
  ) {
    return "Exotel authentication failed. Verify EXOTEL_SID, EXOTEL_API_KEY, and EXOTEL_API_TOKEN in your environment.";
  }
  if (lower.includes("cannot reach localhost")) {
    return "Callback URL is not publicly reachable. Set CALLBACK_BASE_URL to a public HTTPS URL.";
  }
  if (lower.includes("sid") && lower.includes("required")) {
    return "Exotel credentials are missing. Set EXOTEL_SID, EXOTEL_API_KEY and EXOTEL_API_TOKEN.";
  }
  return message || "Failed to initiate call";
}

// POST /api/twilio/call
// Initiates an outbound call to a lead
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
          retryable: false,
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { leadId, agentId, language } = body;

    if (!leadId) return badRequest("leadId is required", "MISSING_LEAD_ID");

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: "Organization not found",
          code: "ORG_NOT_FOUND",
          retryable: false,
        },
        { status: 404 },
      );
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: user.organizationId },
    });
    if (!lead) {
      return NextResponse.json(
        {
          success: false,
          error: "Lead not found",
          code: "LEAD_NOT_FOUND",
          retryable: false,
        },
        { status: 404 },
      );
    }

    if (!lead.phone)
      return badRequest("Lead has no phone number", "MISSING_LEAD_PHONE");

    // Get agent (use default if not specified)
    let agent;
    if (agentId) {
      agent = await prisma.agent.findUnique({ where: { id: agentId } });
    } else {
      agent = await prisma.agent.findFirst({
        where: {
          organizationId: user.organizationId,
          isDefault: true,
          isActive: true,
        },
      });
    }
    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: "No active agent found",
          code: "AGENT_NOT_FOUND",
          retryable: false,
        },
        { status: 404 },
      );
    }

    const formattedPhone = formatPhoneE164(lead.phone);
    console.log(
      "[Twilio Call] leadId=",
      lead.id,
      "leadPhone=",
      lead.phone,
      "formattedPhone=",
      formattedPhone,
      "agentId=",
      agent.id,
    );

    const exotelNumber =
      process.env.EXOTEL_VIRTUAL_NUMBER || process.env.EXOTEL_CALLER_ID || "";
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER || "";
    if (formattedPhone === exotelNumber || formattedPhone === twilioNumber) {
      console.error(
        "[Twilio Call] destination matches provider number, aborting call",
        { formattedPhone, exotelNumber, twilioNumber },
      );
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid lead phone number. It matches the outbound provider number.",
        },
        { status: 400 },
      );
    }

    const fromNumber = exotelNumber || twilioNumber || undefined;
    const conversation = await prisma.conversation.create({
      data: {
        organizationId: user.organizationId,
        agentId: agent.id,
        channel: "VOICE",
        status: "ACTIVE",
        callDirection: "OUTBOUND",
        phoneTo: formattedPhone,
        phoneFrom: fromNumber,
        leadId: lead.id,
        detectedLanguage: language || "en-IN", // ← ADD THIS LINE
      },
    });

    const callResult = await makeOutboundCall({
      to: formattedPhone,
      agentId: agent.id,
      leadId: lead.id,
      organizationId: user.organizationId,
      language: language || "en-IN",
    });

    if (!callResult.success) {
      const errorMessage =
        "error" in callResult ? callResult.error : "Failed to initiate call";
      const friendlyError = getUserFacingError(errorMessage || "");
      const status = inferErrorStatus(errorMessage || "");

      await prisma.conversation
        .update({
          where: { id: conversation.id },
          data: { status: "CLOSED", endedAt: new Date() },
        })
        .catch(() => null);

      return NextResponse.json(
        {
          success: false,
          error: friendlyError,
          providerError: errorMessage,
          code: "CALL_INIT_FAILED",
          retryable: status >= 500,
        },
        { status },
      );
    }

    const callSid = callResult.callSid;

    await prisma.conversation
      .update({
        where: { id: conversation.id },
        data: { twilioCallSid: callSid },
      })
      .catch(() => null);

    // Log activity
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        type: "call_initiated",
        title: `Outbound call initiated`,
        description: `Calling ${formattedPhone}`,
        actorType: "user",
        actorId: user.id,
        metadata: { callSid },
      },
    });

    // Update lead
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastContactedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      callSid,
      phone: formattedPhone,
      message: "Call initiated successfully",
    });
  } catch (error: any) {
    console.error("[Twilio Call] Error:", error);
    const rawMessage = error?.message ?? "Failed to initiate call";
    const friendlyError = getUserFacingError(rawMessage);
    const status = inferErrorStatus(rawMessage);
    return NextResponse.json(
      {
        success: false,
        error: friendlyError,
        providerError: rawMessage,
        code: "CALL_ROUTE_ERROR",
        retryable: status >= 500,
      },
      { status },
    );
  }
}
