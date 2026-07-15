import { prisma } from "../../lib/prisma";
const TRANSFER_MESSAGES = {
    reception: {
        "en-IN": "Please hold while I connect you to our receptionist.",
        "hi-IN": "कृपया प्रतीक्षा करें, मैं आपको रिसेप्शन से जोड़ रहा हूँ।",
        "kn-IN": "ದಯವಿಟ್ಟು ಕಾಯಿರಿ, ನಾನು ನಿಮ್ಮನ್ನು ರಿಸೆಪ್ಷನ್‌ಗೆ ಸಂಪರ್ಕಿಸುತ್ತಿದ್ದೇನೆ.",
    },
    emergency: {
        "en-IN": "Please stay on the line while I connect you to our emergency team.",
        "hi-IN": "कृपया लाइन पर बने रहें, मैं आपको आपातकालीन टीम से जोड़ रहा हूँ।",
        "kn-IN": "ದಯವಿಟ್ಟು ಲೈನ್‌ನಲ್ಲಿ ಇರಿ, ನಾನು ನಿಮ್ಮನ್ನು ತುರ್ತು ವೈದ್ಯಕೀಯ ತಂಡಕ್ಕೆ ಸಂಪರ್ಕಿಸುತ್ತಿದ್ದೇನೆ.",
    },
};
/**
 * Single implementation replacing the two near-identical blocks that used to
 * live inline in websocket-handler.ts (reception transfer ~line 1288-1331,
 * emergency transfer ~line 1334-1377): same TransferIntent upsert, same
 * "speak then close the socket" sequence, just parameterized by `kind`.
 */
async function executeTransfer(kind, ctx) {
    const { session, memory } = ctx;
    await prisma.transferIntent.upsert({
        where: { callSid: session.callSid },
        update: { intent: kind },
        create: { callSid: session.callSid, intent: kind },
    });
    memory.activeIntent = kind === "reception" ? "transfer_to_reception" : "emergency";
    const message = TRANSFER_MESSAGES[kind][memory.language] ?? TRANSFER_MESSAGES[kind]["en-IN"];
    await ctx.speak(message);
    ctx.endCall(1000);
    return { success: true, transferredTo: kind };
}
export const transferToReceptionTool = {
    name: "transfer_to_reception",
    description: "Transfer the caller to a human receptionist/front desk.",
    parameters: {
        type: "object",
        properties: { reason: { type: "string", description: "Why the caller wants a human" } },
    },
    execute: async (_args, ctx) => executeTransfer("reception", ctx),
};
export const transferToEmergencyTool = {
    name: "transfer_to_emergency",
    description: "Transfer the caller to the emergency team immediately. Always call this — never answer conversationally — when emergency symptoms are described.",
    parameters: {
        type: "object",
        properties: { reason: { type: "string", description: "The emergency symptom described" } },
    },
    execute: async (_args, ctx) => executeTransfer("emergency", ctx),
};
