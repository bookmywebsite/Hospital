import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function buildExotelResponse(intent: string) {
  return new Response(
    JSON.stringify({
      select: intent,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    }
  );
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const callSid =
      searchParams.get("CallSid") ||
      searchParams.get("CurrentCallSid") ||
      "";

    console.log("[PASSTHRU GET]", callSid);

    if (!callSid) {
      console.log("[PASSTHRU] No CallSid received");

      return buildExotelResponse("none");
    }

    const transfer = await prisma.transferIntent.findUnique({
      where: {
        callSid,
      },
    });

    const intent = (transfer?.intent ?? "none")
      .trim()
      .toLowerCase();

    console.log("[PASSTHRU LOOKUP]", callSid);
    console.log("[PASSTHRU RECORD]", transfer);
    console.log(
      "[PASSTHRU RESPONSE]",
      JSON.stringify({
        select: intent,
      })
    );

    if (transfer) {
      await prisma.transferIntent.deleteMany({
        where: {
          callSid,
        },
      });
    }

    return buildExotelResponse(intent);
  } catch (error) {
    console.error("[PASSTHRU GET ERROR]", error);

    return buildExotelResponse("none");
  }
}

export async function POST(req: NextRequest) {
  try {
    let data: Record<string, any> = {};

    try {
      const body = await req.formData();

      data = Object.fromEntries(body.entries());

      console.log("[PASSTHRU BODY]", data);
    } catch {
      console.log("[PASSTHRU BODY] No form data");
    }

    const callSid = String(
      data.CallSid ||
        data.CurrentCallSid ||
        data.CallUUID ||
        ""
    );

    if (!callSid) {
      return buildExotelResponse("none");
    }

    const transfer = await prisma.transferIntent.findUnique({
      where: {
        callSid,
      },
    });

    const intent = (transfer?.intent ?? "none")
      .trim()
      .toLowerCase();

    console.log("[PASSTHRU LOOKUP]", callSid);
    console.log("[PASSTHRU RECORD]", transfer);
    console.log(
      "[PASSTHRU RESPONSE]",
      JSON.stringify({
        select: intent,
      })
    );

    if (transfer) {
      await prisma.transferIntent.deleteMany({
        where: {
          callSid,
        },
      });
    }

    return buildExotelResponse(intent);
  } catch (error) {
    console.error("[PASSTHRU POST ERROR]", error);

    return buildExotelResponse("none");
  }
}