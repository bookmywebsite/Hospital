import type { ToolContext } from "../ai/tools/types";
import { prisma } from "../lib/prisma";

const TRANSFER_MESSAGES: Record<string, Record<string, string>> = {
  reception: {
    "en-IN": "Please hold while I connect you to our receptionist.",
    "hi-IN": "कृपया प्रतीक्षा करें, मैं आपको रिसेप्शन से जोड़ रहा हूँ।",
    "kn-IN": "ದಯವಿಟ್ಟು ಕಾಯಿರಿ, 나는 ನಿಮ್ಮನ್ನು ರಿಸೆಪ್ಷನ್‌ಗೆ ಸಂಪರ್ಕಿಸುತ್ತಿದ್ದೇನೆ.",
  },
  emergency: {
    "en-IN": "Please stay on the line while I connect you to our emergency team.",
    "hi-IN": "कृपया लाइन पर बने रहें, मैं आपको आपातकालीन टीम से जोड़ रहा हूँ।",
    "kn-IN": "ದಯವಿಟ್ಟು ಲೈನ್‌ನಲ್ಲಿ ಇರಿ, ನಾನು ನಿಮ್ಮನ್ನು ತುರ್ತು ವೈದ್ಯಕೀಯ ತಂಡಕ್ಕೆ ಸಂಪರ್ಕಿಸುತ್ತಿದ್ದೇನೆ.",
  },
};

export async function transferToReception(ctx: ToolContext) {
  const { session, memory } = ctx;
  await prisma.transferIntent.upsert({
    where: { callSid: session.callSid },
    update: { intent: "reception" },
    create: { callSid: session.callSid, intent: "reception" },
  });
  const message = TRANSFER_MESSAGES.reception[memory.language] ?? TRANSFER_MESSAGES.reception["en-IN"];
  await ctx.speak(message);
  ctx.endCall(1000);
  return { success: true, transferredTo: "reception" };
}

export async function transferToEmergency(ctx: ToolContext) {
  const { session, memory } = ctx;
  await prisma.transferIntent.upsert({
    where: { callSid: session.callSid },
    update: { intent: "emergency" },
    create: { callSid: session.callSid, intent: "emergency" },
  });
  const message = TRANSFER_MESSAGES.emergency[memory.language] ?? TRANSFER_MESSAGES.emergency["en-IN"];
  await ctx.speak(message);
  ctx.endCall(1000);
  return { success: true, transferredTo: "emergency" };
}
