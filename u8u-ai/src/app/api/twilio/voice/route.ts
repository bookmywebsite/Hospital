// PATH: src/app/api/twilio/voice/route.ts
// Inbound & outbound first webhook: greet, create conversation, start Gather loop.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateGreeting, getVoiceConfig } from "@/lib/voice/language-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function xmlEsc(t: string) {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatPhone(p: string): string {
  let n = p.replace(/\D/g, "");
  if (n.length === 10) n = "91" + n;
  return n.startsWith("+") ? p : "+" + n;
}

/** Map DB codes (EN, HI) or pass-through (en-IN) for Twilio */
function normalizeTwilioLanguage(lang: string): string {
  if (lang.includes("-")) return lang;
  const m: Record<string, string> = {
    EN: "en-IN",
    HI: "hi-IN",
    KN: "kn-IN",
    TA: "ta-IN",
    TE: "te-IN",
    ML: "ml-IN",
    MR: "mr-IN",
    BN: "bn-IN",
    GU: "gu-IN",
    PA: "pa-IN",
    OR: "or-IN",
  };
  return m[lang.toUpperCase()] ?? "en-IN";
}

export async function POST(request: NextRequest) {
  try {
    console.log(`[Voice Route] POST ${request.url}`);
    const form = await request.formData();
    const callSid = (form.get("CallSid") as string) || "";
    const from = (form.get("From") as string) || "";
    const to = (form.get("To") as string) || "";
    const answeredBy = (form.get("AnsweredBy") as string) || "";

    const { searchParams } = new URL(request.url);
    const callType = searchParams.get("callType") || "inbound";
    const purpose = searchParams.get("purpose") || "";
    let language = normalizeTwilioLanguage(
      searchParams.get("language") ?? "en-IN",
    );
    const agentId = searchParams.get("agentId") || "";
    const leadIdParam = searchParams.get("leadId") || "";
    const patientIdParam = searchParams.get("patientId") || "";

    // Inbound: patient is `From`. Outbound: patient is `To` (From is our Twilio number).
    const remotePhone = callType === "outbound" ? to : from;

    console.log(`[Voice] ${callType} remote=${remotePhone} sid=${callSid}`);

    const agent = agentId
      ? await prisma.agent.findUnique({
          where: { id: agentId },
          include: { organization: true },
        })
      : await prisma.agent.findFirst({
          where: { isDefault: true, isActive: true },
          include: { organization: true },
        });

    if (!agent) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="en-IN">Thank you for calling. We will call you back shortly. Goodbye!</Say><Hangup/></Response>`,
        { headers: { "Content-Type": "text/xml" } },
      );
    }

    const hospName =
      agent.companyName ||
      agent.organization?.name ||
      process.env.HOSPITAL_NAME ||
      "City Hospital";

    if (answeredBy.startsWith("machine")) {
      const msg = `Hi! This is the AI health assistant from ${hospName}. We tried to reach you. Please call us back at your convenience. Thank you and have a great day!`;
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi" rate="fast" language="${language}">${xmlEsc(msg)}</Say><Hangup/></Response>`,
        { headers: { "Content-Type": "text/xml" } },
      );
    }

    let lead: {
      id: string;
      firstName: string | null;
      status: string;
      phone: string | null;
      doNotCall: boolean;
    } | null = null;
    let patient: {
      id: string;
      firstName: string | null;
      patientStatus: string;
      phone: string | null;
      doNotContact: boolean;
      preferredLanguage: string;
    } | null = null;

    if (patientIdParam) {
      patient = await prisma.patient.findUnique({
        where: { id: patientIdParam },
        select: {
          id: true,
          firstName: true,
          patientStatus: true,
          phone: true,
          doNotContact: true,
          preferredLanguage: true,
        },
      });
    }

    if (!patient && leadIdParam) {
      lead = await prisma.lead.findUnique({
        where: { id: leadIdParam },
        select: {
          id: true,
          firstName: true,
          status: true,
          phone: true,
          doNotCall: true,
        },
      });
    }

    if (!lead && !patient && remotePhone) {
      const formattedPhone = formatPhone(remotePhone);
      patient = await prisma.patient.findFirst({
        where: { organizationId: agent.organizationId, phone: formattedPhone },
        select: {
          id: true,
          firstName: true,
          patientStatus: true,
          phone: true,
          doNotContact: true,
          preferredLanguage: true,
        },
      });

      if (!patient) {
        lead = await prisma.lead.findFirst({
          where: {
            organizationId: agent.organizationId,
            phone: formattedPhone,
          },
          select: {
            id: true,
            firstName: true,
            status: true,
            phone: true,
            doNotCall: true,
          },
        });
      }

      if (!lead && !patient) {
        const selectP = {
          id: true,
          firstName: true,
          patientStatus: true,
          phone: true,
          doNotContact: true,
          preferredLanguage: true,
        } as const;
        try {
          patient = await prisma.patient.create({
            data: {
              organizationId: agent.organizationId,
              phone: formattedPhone,
              source: callType === "inbound" ? "inbound_call" : "outbound_call",
              patientStatus: "NEW",
            },
            select: selectP,
          });
        } catch {
          patient = await prisma.patient.findFirst({
            where: {
              organizationId: agent.organizationId,
              phone: formattedPhone,
            },
            select: selectP,
          });
        }
      }
    }

    if (patient?.preferredLanguage) {
      language = normalizeTwilioLanguage(patient.preferredLanguage);
    }

    const conv = await prisma.conversation.create({
      data: {
        organizationId: agent.organizationId,
        agentId: agent.id,
        leadId: lead?.id ?? null,
        patientId: patient?.id ?? null,
        channel: "VOICE",
        status: "ACTIVE",
        twilioCallSid: callSid,
        sessionId: callSid,
        phoneFrom: from,
        phoneTo: to,
        callDirection: callType === "outbound" ? "OUTBOUND" : "INBOUND",
        detectedLanguage: language,
        startedAt: new Date(),
      },
    });

    const firstName = patient?.firstName ?? lead?.firstName ?? "";

    if (patient) {
      Promise.all([
        prisma.patient.update({
          where: { id: patient.id },
          data: {
            patientStatus:
              patient.patientStatus === "NEW"
                ? "CONTACTED"
                : (patient.patientStatus as any),
            lastContactedAt: new Date(),
            lastCallAt: new Date(),
            totalCalls: { increment: 1 },
          },
        }),
        prisma.callLog.create({
          data: {
            organizationId: agent.organizationId,
            patientId: patient.id,
            callSid,
            direction: callType === "inbound" ? "INBOUND" : "OUTBOUND",
            status: "IN_PROGRESS",
            fromNumber: from || "",
            toNumber: to || "",
            language: language.split("-")[0]?.toUpperCase() ?? "EN",
            startedAt: new Date(),
          },
        }),
        prisma.activity.create({
          data: {
            patientId: patient.id,
            type: `${callType}_call_started`,
            title: `${callType === "inbound" ? "Inbound" : "Outbound"} call started`,
            description: `Remote: ${remotePhone || from} | Purpose: ${purpose || "general"}`,
            actorType: "agent",
            actorId: agent.id,
            metadata: { callSid, from, to, callType, purpose },
          },
        }),
      ]).catch((e) => console.error("[Voice] DB log error:", e));
    } else if (lead) {
      Promise.all([
        prisma.lead.update({
          where: { id: lead.id },
          data: {
            status: lead.status === "NEW" ? "CONTACTED" : (lead.status as any),
            lastContactedAt: new Date(),
            lastCallAt: new Date(),
            totalCalls: { increment: 1 },
          },
        }),
        prisma.callLog.create({
          data: {
            organizationId: agent.organizationId,
            leadId: lead.id,
            callSid,
            direction: callType === "inbound" ? "INBOUND" : "OUTBOUND",
            status: "IN_PROGRESS",
            fromNumber: from || "",
            toNumber: to || "",
            language: language.split("-")[0]?.toUpperCase() ?? "EN",
            startedAt: new Date(),
          },
        }),
        prisma.activity.create({
          data: {
            leadId: lead.id,
            type: `${callType}_call_started`,
            title: `${callType === "inbound" ? "Inbound" : "Outbound"} call started`,
            description: `Remote: ${remotePhone || from} | Purpose: ${purpose || "general"}`,
            actorType: "agent",
            actorId: agent.id,
            metadata: { callSid, from, to, callType, purpose },
          },
        }),
      ]).catch((e) => console.error("[Voice] DB log error:", e));
    }

    const BASE_URL = process.env.NEXT_PUBLIC_APP_URL!;
    const gatherQs = new URLSearchParams({
      language,
      conversationId: conv.id,
      callType,
    });
    if (purpose) gatherQs.set("purpose", purpose);
    if (patient?.id) gatherQs.set("patientId", patient.id);
    if (lead?.id) gatherQs.set("leadId", lead.id);
    const gatherUrl = `${BASE_URL}/api/twilio/gather?${gatherQs.toString()}`;

    let greeting: string;
    if (callType === "outbound" && purpose) {
      greeting = buildOutboundGreeting(
        purpose,
        agent.name,
        hospName,
        firstName,
        language.split("-")[0],
      );
    } else if (callType === "inbound" && firstName) {
      greeting = generateGreeting(
        agent.name,
        firstName,
        language.split("-")[0],
      );
    } else {
      greeting = generateGreeting(
        agent.name,
        firstName || "there",
        language.split("-")[0],
      );
    }

    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" rate="fast" language="${language}">${xmlEsc(greeting)}</Say>
  <Gather input="speech" action="${gatherUrl}" method="POST"
    speechTimeout="1" timeout="1" language="${language}">
  </Gather>
  <Hangup/>
</Response>`,
      { headers: { "Content-Type": "text/xml" } },
    );
  } catch (err) {
    console.error("[Voice] Fatal:", err);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you for calling. Please try again. Goodbye!</Say><Hangup/></Response>`,
      { headers: { "Content-Type": "text/xml" } },
    );
  }
}

export async function GET(request: NextRequest) {
  console.log(`[Voice Route] GET ${request.url}`);
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">
    PrimePro voice webhook is working
  </Say>
</Response>`,
    {
      headers: {
        "Content-Type": "text/xml",
      },
    },
  );
}

function buildOutboundGreeting(
  purpose: string,
  agentName: string,
  hospName: string,
  patientName: string,
  languageCode: string,
): string {
  const name = patientName || "there";
  const p = purpose.toLowerCase();
  let greetingTemplate = "";

  // Get basic greeting based on purpose (English for now - can expand to support all languages)
  if (p.includes("missed"))
    greetingTemplate = `Hi {name}! This is {agent} from {hosp}. You had tried to reach us earlier. How can I help you today?`;
  else if (p.includes("reminder"))
    greetingTemplate = `Hi {name}! This is {agent} from {hosp}. I am calling about your upcoming appointment. Will you be able to make it?`;
  else if (p.includes("reactivat"))
    greetingTemplate = `Hi {name}! This is {agent} from {hosp}. Hope you are doing well. It has been a while since your last visit. Are you facing any health concerns?`;
  else if (p.includes("test") || p.includes("result"))
    greetingTemplate = `Hi {name}! This is {agent} from {hosp}. Your test reports are ready. Would you like to come in to review them with the doctor?`;
  else if (p.includes("treatment") || p.includes("conversion"))
    greetingTemplate = `Hi {name}! This is {agent} from {hosp}. You had enquired about treatment earlier. We have availability this week. Would you like to speak with our specialist?`;
  else if (p.includes("matern") || p.includes("pregnan"))
    greetingTemplate = `Hi {name}! This is {agent} from {hosp}. How is your pregnancy going? Are you having regular checkups?`;
  else if (p.includes("checkup") || p.includes("promo"))
    greetingTemplate = `Hi {name}! This is {agent} from {hosp}. We are offering a full body health checkup at a special price this week. Are you interested?`;
  else if (p.includes("medic"))
    greetingTemplate = `Hi {name}! This is {agent} from {hosp}. Just checking in to make sure you are continuing your medication regularly. How are you feeling?`;
  else if (p.includes("feedback") || p.includes("review"))
    greetingTemplate = `Hi {name}! This is {agent} from {hosp}. You recently visited us. How was your experience?`;
  else if (p.includes("discharge"))
    greetingTemplate = `Hi {name}! This is {agent} from {hosp}. You were recently discharged. How are you feeling? Any discomfort or issues?`;
  else
    greetingTemplate = `Hi {name}! This is {agent} from {hosp}. How can I assist you today?`;

  return greetingTemplate
    .replace("{name}", name)
    .replace("{agent}", agentName)
    .replace("{hosp}", hospName);
}
