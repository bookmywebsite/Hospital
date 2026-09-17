import Twilio from "twilio";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

const twilioClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export async function handleInboundCall(params: {
  callSid: string;
  from: string;
  to: string;
  agentId: string;
}) {
  const agent = await prisma.agent.findUnique({
    where: { id: params.agentId },
  });
  if (!agent) throw new Error("Agent not found");

  let lead = await prisma.lead.findFirst({
    where: { organizationId: agent.organizationId, phone: params.from },
  });
  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        organizationId: agent.organizationId,
        email: `${params.from.replace(/\D/g, "")}@phone.placeholder`,
        phone: params.from,
        source: "phone",
      },
    });
  }

  const conversation = await prisma.conversation.create({
    data: {
      organizationId: agent.organizationId,
      agentId: agent.id,
      leadId: lead.id,
      channel: "VOICE",
      twilioCallSid: params.callSid,
      phoneFrom: params.from,
      phoneTo: params.to,
    },
  });

  return {
    conversationId: conversation.id,
    twiml: generateTwiML({
      message: agent.welcomeMessage,
      conversationId: conversation.id,
    }),
  };
}

export function generateTwiML(params: {
  message: string;
  conversationId: string;
  gather?: boolean;
}): string {
  const { message, conversationId, gather = true } = params;
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  if (gather) {
    return `${escaped}I'm listening.Goodbye!`;
  }
  return `${escaped}`;
}

export async function processSpeechInput(params: {
  conversationId: string;
  speechResult: string;
}): Promise<string> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: params.conversationId },
    include: { agent: true, messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation)
    return generateTwiML({
      message: "Error. Goodbye!",
      conversationId: params.conversationId,
      gather: false,
    });

  await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      role: "user",
      content: params.speechResult,
    },
  });

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are ${conversation.agent.name}, a voice AI. Keep responses SHORT (1-2 sentences). Be natural.`,
    },
    ...conversation.messages.slice(-10).map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: params.speechResult },
  ];

  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",
    messages,
    max_tokens: 100,
    temperature: 0.6,
  });
  const aiResponse =
    completion.choices[0].message.content || "Sorry, I didn't get that.";

  await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      role: "assistant",
      content: aiResponse,
    },
  });
  await prisma.conversation.update({
    where: { id: params.conversationId },
    data: { messageCount: { increment: 2 } },
  });

  const shouldEnd = ["goodbye", "bye", "thanks"].some((p) =>
    params.speechResult.toLowerCase().includes(p),
  );
  return generateTwiML({
    message: aiResponse,
    conversationId: params.conversationId,
    gather: !shouldEnd,
  });
}
