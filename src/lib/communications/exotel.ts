import { URLSearchParams } from "url";

const EXOTEL_API_BASE_URL =
  process.env.EXOTEL_API_BASE_URL?.replace(/\/$/, "") ??
  "https://api.in.exotel.com";

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isTrialAccountError?: boolean;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  providerStatus?: string | null;
  error?: string;
}

export interface OutboundCallResult {
  success: boolean;
  callSid?: string;
  error?: string;
  raw?: any;
}

function getExotelSid() {
  const sid = process.env.EXOTEL_SID;
  if (!sid) {
    throw new Error("EXOTEL_SID must be set for Exotel integration");
  }
  return sid;
}

function getAuthCandidates() {
  const sid = process.env.EXOTEL_SID;
  const apiKey = process.env.EXOTEL_API_KEY;
  const apiToken = process.env.EXOTEL_API_TOKEN;
  if (!apiToken || (!sid && !apiKey)) {
    throw new Error(
      "Set EXOTEL_API_TOKEN and either EXOTEL_SID or EXOTEL_API_KEY for Exotel integration",
    );
  }

  // Prefer API key first (Exotel API auth standard); keep SID fallback for compatibility.
  const usernames = [apiKey, sid].filter((v): v is string => !!v);
  return usernames.map((username) => ({
    label: username === apiKey ? "api_key" : "sid",
    header: `Basic ${Buffer.from(`${username}:${apiToken}`).toString("base64")}`,
  }));
}
function getExotelAuthHeaders() {
  const authCandidates = getAuthCandidates();

  return {
    Authorization: authCandidates[0].header,
    Accept: "application/json",
  };
}

export function formatPhoneE164(phone: string, defaultCountry = "IN"): string {
  const digits = phone.replace(/\D/g, "");
  if (defaultCountry === "IN") {
    if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
    if (digits.length === 10) return `+91${digits}`;
  }
  if (digits.length > 10) return `+${digits}`;
  return `+${digits}`;
}

async function postForm(path: string, params: Record<string, string>) {
  const sid = getExotelSid();
  const url = `${EXOTEL_API_BASE_URL}/v1/Accounts/${sid}${path}`;
  const body = new URLSearchParams(params);
  const authCandidates = getAuthCandidates();

  try {
    for (let i = 0; i < authCandidates.length; i += 1) {
      const auth = authCandidates[i];
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: auth.header,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      const text = await response.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        json = { error: text };
      }

      if (response.ok) {
        return json;
      }

      const errorMsg =
        json?.message || json?.error || text || response.statusText;
      const isUnauthorized = response.status === 401;
      const hasFallback = i < authCandidates.length - 1;
      if (isUnauthorized && hasFallback) {
        console.warn("[Exotel API Auth Retry]", {
          path,
          sid: sid ? `${sid.substring(0, 4)}...` : "not-set",
          failedAuthStyle: auth.label,
        });
        continue;
      }

      console.error("[Exotel API Error]", {
        status: response.status,
        statusText: response.statusText,
        path,
        sid: sid ? `${sid.substring(0, 4)}...` : "not-set",
        authStyle: auth.label,
        errorMessage: errorMsg,
      });
      throw new Error(`Exotel ${response.status}: ${errorMsg}`);
    }

    throw new Error("Exotel request failed with all available auth styles");
  } catch (error: any) {
    throw new Error(`Exotel API failed: ${error.message}`);
  }
}

export async function sendSMSMessage(
  phoneNumber: string,
  message: string,
): Promise<SmsSendResult> {
  const formattedPhone = formatPhoneE164(phoneNumber);
  const from =
    process.env.EXOTEL_SMS_SID ||
    process.env.EXOTEL_VIRTUAL_NUMBER ||
    process.env.EXOTEL_CALLER_ID;

  if (!from) {
    return {
      success: false,
      error:
        "EXOTEL_SMS_SID or EXOTEL_VIRTUAL_NUMBER is required for Exotel SMS",
    };
  }

  try {
    const result = await postForm("/Sms/send", {
      From: from,
      To: formattedPhone,
      Body: message,
    });

    const messageId =
      result?.api_response?.sms?.sid ||
      result?.sms_sid ||
      result?.message_id ||
      null;
    return { success: true, messageId };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message ?? "Failed to send SMS via Exotel",
    };
  }
}

export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string,
): Promise<WhatsAppSendResult> {
  const formattedPhone = formatPhoneE164(phoneNumber);
  const defaultApiPath =
    process.env.EXOTEL_WHATSAPP_API_PATH || "/v1/Accounts/{sid}/Whatsapp/Send";
  const sender =
    process.env.EXOTEL_WHATSAPP_NUMBER || process.env.EXOTEL_VIRTUAL_NUMBER;

  if (!sender) {
    return {
      success: false,
      error:
        "EXOTEL_WHATSAPP_NUMBER or EXOTEL_VIRTUAL_NUMBER is required for Exotel WhatsApp",
    };
  }

  const sid = process.env.EXOTEL_SID;
  if (!sid) {
    return {
      success: false,
      error: "EXOTEL_SID is required for Exotel WhatsApp",
    };
  }

  const resolvedPaths = [defaultApiPath.replace("{sid}", sid)];

  if (!resolvedPaths[0].endsWith(".json")) {
    resolvedPaths.push(`${resolvedPaths[0]}.json`);
  }
  if (resolvedPaths[0].includes("/v1/")) {
    resolvedPaths.push(resolvedPaths[0].replace("/v1/", "/v2/"));
  }

  for (const path of Array.from(new Set(resolvedPaths))) {
    try {
      const result = await postForm(path, {
        From: sender,
        To: formattedPhone,
        Body: message,
      });

      const messageId =
        result?.api_response?.message?.sid || result?.message_id || null;
      return {
        success: true,
        messageId,
        providerStatus: result?.api_response?.status || null,
      };
    } catch (error: any) {
      const rawMessage = error?.message ?? "";
      if (
        !rawMessage.includes("405") &&
        !rawMessage.toLowerCase().includes("no such controller") &&
        !rawMessage.toLowerCase().includes("not found")
      ) {
        const sandboxHint = rawMessage.includes("Method not allowed")
          ? " Lead may need to join the Exotel WhatsApp sandbox before receiving messages."
          : "";
        return {
          success: false,
          error: `${rawMessage}${sandboxHint}`,
        };
      }

      if (path === Array.from(new Set(resolvedPaths)).pop()) {
        const sandboxHint = rawMessage.includes("Method not allowed")
          ? " Lead may need to join the Exotel WhatsApp sandbox before receiving messages."
          : "";
        return {
          success: false,
          error: `${rawMessage}${sandboxHint}`,
        };
      }
    }
  }

  return {
    success: false,
    error:
      "Failed to send WhatsApp via Exotel. Please verify your Exotel WhatsApp endpoint and sandbox setup.",
  };
}

export async function makeOutboundCall(options: {
  to: string;
  from?: string;
  url: string;
  statusCallback?: string;
  statusCallbackMethod?: string;
  timeout?: number;
  machineDetection?: string;
  record?: boolean;
  language?: string;
  agentId?: string;
  leadId?: string;
  organizationId?: string;
}) {
  let formattedTo = options.to.replace(/\D/g, "");

  if (formattedTo.startsWith("91") && formattedTo.length === 12) {
    formattedTo = formattedTo.slice(2);
  }
  const from =
    options.from ||
    process.env.EXOTEL_VIRTUAL_NUMBER ||
    process.env.EXOTEL_CALLER_ID;
  if (!from) {
    throw new Error(
      "EXOTEL_VIRTUAL_NUMBER or EXOTEL_CALLER_ID is required for Exotel outbound calls",
    );
  }

  const statusCallback = options.statusCallback || "";
  const APP_ID = process.env.EXOTEL_APP_ID || "41887"; // Exotel app ID — set EXOTEL_APP_ID in .env
  const sid = getExotelSid();
  if (process.env.NODE_ENV !== "production") {
    console.log("[Exotel Call Debug]", {
      sidPresent: !!process.env.EXOTEL_SID,
      apiKeyPresent: !!process.env.EXOTEL_API_KEY,
      apiTokenPresent: !!process.env.EXOTEL_API_TOKEN,
      sidPrefix: process.env.EXOTEL_SID
        ? `${process.env.EXOTEL_SID.slice(0, 4)}...`
        : "not-set",
    });

    console.log("[Exotel Call Payload]", {
      From: formattedTo, // lead number (Exotel dials this first)
      To: from.replace(/\D/g, ""), // your Exotel virtual number
      Url: `http://my.in.exotel.com/${sid}/exoml/start_voice/${APP_ID}`,
      StatusCallback: statusCallback,
      Timeout: options.timeout ?? 30,
    });
  }

  const payload: Record<string, string> = {
    From: formattedTo, // lead's number — Exotel calls this first
    To: from.replace(/\D/g, ""), // your Exotel virtual/caller-ID number
    Url: `http://my.in.exotel.com/${sid}/exoml/start_voice/${APP_ID}`,
    StatusCallback: statusCallback,
    StatusCallbackMethod: "POST",
    // CustomField is forwarded to the WebSocket as customParameters
    // This is how the voice bot receives the selected language
    CustomField: options.language || "en-IN",
  };

  // Ensure the recipient gets enough ring time before Exotel marks the attempt as failed.
  payload.Timeout = String(
    typeof options.timeout === "number" ? options.timeout : 30,
  );

  try {
    const result = await postForm("/Calls/connect.json", payload);
    console.log("EXOTEL RAW RESPONSE:", JSON.stringify(result, null, 2));
    const callSid =
      result?.api_response?.call_sid ||
      result?.api_response?.Call?.Sid ||
      result?.Call?.Sid ||
      result?.call_sid ||
      result?.ApiResponse?.CallSid ||
      result?.RestResponse?.Call?.Sid ||
      null;

    if (!callSid) {
      const providerMessage =
        result?.RestException?.Message ||
        result?.error ||
        result?.message ||
        JSON.stringify(result).slice(0, 240);
      return {
        success: false,
        error: `Exotel did not return a call SID. ${providerMessage ?? "Call may not have been accepted."}`,
      };
    }

    return { success: true, callSid, raw: result };
  } catch (error: any) {
    const msg = error?.message ?? "Failed to initiate Exotel call";
    if (
      msg.includes("Exotel 401") ||
      msg.includes('"Code":34010') ||
      msg.includes("<Code>34010</Code>")
    ) {
      return {
        success: false,
        error:
          "Exotel authentication failed (401/34010). Verify that EXOTEL_SID, EXOTEL_API_KEY, and EXOTEL_API_TOKEN belong to the same Exotel account and regenerate API Token if needed.",
      };
    }
    return { success: false, error: msg };
  }
}

export async function verifyConnection() {
  try {
    const sid = process.env.EXOTEL_SID;

    if (!sid) {
      return {
        success: false,
        message: "Exotel SID is not configured",
      };
    }

    const response = await fetch(
      `${EXOTEL_API_BASE_URL}/v1/Accounts/${sid}`,
      {
        method: "GET",
        headers: getExotelAuthHeaders(),
      }
    );

    if (!response.ok) {
      return {
        success: false,
        message: `Exotel verification failed: ${response.status}`,
      };
    }

    const xml = await response.text();

    const sidMatch = xml.match(/<Sid>(.*?)<\/Sid>/);

    return {
      success: true,
      message: `Exotel connected: ${sidMatch?.[1] || sid}`,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Exotel verification failed",
    };
  }
}