import * as exotel from "./exotel";
import * as twilio from "../../lib/twilio";
const providerEnv = process.env.COMM_PROVIDER?.toLowerCase().trim();
const provider = providerEnv ||
    (process.env.EXOTEL_SID && process.env.EXOTEL_API_TOKEN
        ? "exotel"
        : undefined) ||
    (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
        ? "twilio"
        : "exotel");
export const isExotel = provider === "exotel";
export const isTwilio = provider === "twilio";
export const COMM_PROVIDER = provider;
function normalizeBaseUrl(value) {
    return (value ?? "")
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/\/+$/, "");
}
function getWebhookBaseUrl() {
    // Prefer a dedicated webhook URL for telephony providers when testing locally.
    const preferred = normalizeBaseUrl(process.env.CALLBACK_BASE_URL) ||
        normalizeBaseUrl(process.env.WEBHOOK_BASE_URL) ||
        normalizeBaseUrl(process.env.VOICE_AI_BASE_URL) ||
        normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
    if (!preferred) {
        throw new Error("Set CALLBACK_BASE_URL, VOICE_AI_BASE_URL, or NEXT_PUBLIC_APP_URL for call webhooks");
    }
    if (isExotel && /localhost|127\.0\.0\.1/i.test(preferred)) {
        throw new Error("Exotel cannot reach localhost callbacks. Set CALLBACK_BASE_URL to a public HTTPS URL (for example ngrok/cloudflared tunnel).");
    }
    return preferred;
}
export async function sendSMSMessage(phoneNumber, message) {
    if (isExotel)
        return await exotel.sendSMSMessage(phoneNumber, message);
    return await twilio.sendSMSMessage(phoneNumber, message);
}
export async function sendWhatsAppMessage(phoneNumber, message) {
    if (isExotel)
        return await exotel.sendWhatsAppMessage(phoneNumber, message);
    return await twilio.sendWhatsAppMessage(phoneNumber, message);
}
export async function makeOutboundCall(options) {
    const base = getWebhookBaseUrl();
    // Normalise: "TE" → "te-IN",  "te-IN" → "te-IN"
    const rawLang = options.language ?? "EN";
    const lang = rawLang.length === 2 ? `${rawLang.toLowerCase()}-IN` : rawLang;
    let callUrl = options.url;
    if (isExotel) {
        if (!callUrl) {
            const wsParams = new URLSearchParams({
                agentId: options.agentId,
                leadId: options.leadId ?? "",
                patientId: options.patientId ?? "",
                orgId: options.organizationId,
                language: lang,
                callType: options.callType ?? "outbound",
                purpose: options.purpose ?? "",
            });
            callUrl = `${base}/api/exotel/voicebot/wss?${wsParams.toString()}`;
        }
        else if (callUrl.includes("/api/twilio/voice")) {
            const parsed = new URL(callUrl, base);
            const params = new URLSearchParams(parsed.searchParams);
            params.set("agentId", options.agentId);
            params.set("leadId", options.leadId ?? params.get("leadId") ?? "");
            params.set("patientId", options.patientId ?? params.get("patientId") ?? "");
            params.set("orgId", options.organizationId);
            params.set("language", lang);
            if (options.callType)
                params.set("callType", options.callType);
            if (options.purpose)
                params.set("purpose", options.purpose);
            callUrl = `${base}/api/exotel/voicebot/wss?${params.toString()}`;
        }
    }
    else {
        if (!callUrl) {
            callUrl = `${base}/api/twilio/voice?agentId=${encodeURIComponent(options.agentId)}&leadId=${encodeURIComponent(options.leadId ?? "")}&orgId=${encodeURIComponent(options.organizationId)}&language=${encodeURIComponent(lang)}`;
        }
    }
    const callOptions = {
        to: options.to,
        from: isExotel
            ? process.env.EXOTEL_VIRTUAL_NUMBER || process.env.EXOTEL_CALLER_ID
            : process.env.TWILIO_PHONE_NUMBER,
        url: callUrl,
        statusCallback: options.statusCallback ?? `${base}/api/twilio/status`,
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        statusCallbackMethod: options.statusCallbackMethod ?? "POST",
        record: true,
        recordingStatusCallback: `${base}/api/twilio/recording`,
        timeout: isExotel ? (options.timeout ?? 30) : options.timeout,
    };
    if (process.env.NODE_ENV !== "production") {
        console.log("[Outbound Call] provider=", COMM_PROVIDER, "callOptions=", callOptions);
    }
    try {
        if (isExotel) {
            const result = await exotel.makeOutboundCall(callOptions);
            return result; // Exotel already returns { success, callSid, error }
        }
        else {
            const callSid = await twilio.makeOutboundCall(options);
            return { success: true, callSid };
        }
    }
    catch (error) {
        return {
            success: false,
            error: error.message || "Failed to initiate call",
        };
    }
}
export async function verifyIntegration(service) {
    switch (service) {
        case "exotel":
            return await exotel.verifyConnection();
        case "twilio":
            return ((await twilio.verifyConnection?.()) ?? {
                success: false,
                message: "Twilio verify not implemented",
            });
        default:
            return { success: false, message: "Unknown service" };
    }
}
export const formatPhoneE164 = exotel.formatPhoneE164;
