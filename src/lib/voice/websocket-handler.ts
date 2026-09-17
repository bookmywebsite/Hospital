/**
 * Voice AI Streaming WebSocket Handler
 * Orchestrates: Deepgram STT → Planner → Tools → Cartesia TTS
 * Supports Twilio and Exotel media streams
 * Production-ready with error handling and logging
 */

import WebSocket from "ws";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DeepgramLiveSTT } from "./deepgram-stt";
import { CartesiaLiveTTS } from "./cartesiaTTS";
import { isNoiseUtterance, SupportedLanguage } from "./language-detection";
import { prisma } from "../prisma";
import { handleAgentTurn } from "../../ai/conversation/agent-turn";

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const chunkLogStream = fs.createWriteStream(path.resolve(__dirname, "../../../chunks.log"), {
  flags: "a",
});

const ORPHAN_MEDIA_MAP = new Map<string, { chunks: Buffer[]; timestamp: number }>();

export interface SessionState {
  ws: WebSocket;
  sessionId: string;
  callSid: string;
  organizationId?: string;
  language: SupportedLanguage;
  stt: DeepgramLiveSTT | null;
  tts: CartesiaLiveTTS | null;
  brain: any;
  isAgentSpeaking: boolean;
  bargeInDetected: boolean;
  fullTranscript: string;
  startTime: number;
  conversationId?: string;
  provider: "twilio" | "exotel";
  outboundSequence: number;
  outboundChunk: number;
  lastTimestamp?: number;
  exotelInBuffer?: Buffer;
  exotelOutBuffer?: Buffer;
  heartbeatTimer?: NodeJS.Timeout;
  silenceTimer?: NodeJS.Timeout;
  llmPaddingTimer?: NodeJS.Timeout;
  sttWatchdogTimer?: NodeJS.Timeout;
  sttReady: boolean;
  audioQueue: Buffer[];
  isEnding?: boolean;
  isProcessingSpeech?: boolean;
  intent?: string;
  data?: Record<string, any>;
  callerNumber?: string;
  leadId?: string;
  contactEmail?: string;
  contactName?: string;
  languageLocked: boolean;
  greetingPlayed?: boolean;
  lastInteractionAt?: number;
  lastSpeechAt?: number;
  silenceWarningSent?: boolean;
  silenceHangupSent?: boolean;
  isUserSpeaking?: boolean;
  transferAlreadyMentioned?: boolean;
  bargeInTranscript?: string | null;
  detectionCount?: number;
  lastDetectedLanguage?: string;
  speechQueue?: string[];
  responseId?: number;
  lastUserTranscript?: string;
  currentLLMRequestId?: number;
  cancelCurrentResponse?: boolean;
  interruptRequested?: boolean;
}

const SESSION_MAP = new Map<string, SessionState>();

function _hospitalNameForSilence(): string {
  return process.env.HOSPITAL_NAME || "the hospital";
}

function initializeSession(
  ws: WebSocket,
  callData: {
    streamSid: string;
    callSid: string;
    organizationId?: string;
    language?: string;
    provider: "twilio" | "exotel";
  },
): SessionState {
  const sessionId = callData.streamSid;
  const session: SessionState = {
    ws,
    sessionId,
    callSid: callData.callSid,
    organizationId: callData.organizationId,
    language: (callData.language as SupportedLanguage) || SupportedLanguage.EN,
    stt: null,
    tts: null,
    brain: null,
    isAgentSpeaking: false,
    bargeInDetected: false,
    fullTranscript: "",
    startTime: Date.now(),
    provider: callData.provider,
    outboundSequence: 0,
    outboundChunk: 0,
    exotelOutBuffer: Buffer.alloc(0),
    sttReady: false,
    languageLocked: false,
    greetingPlayed: false,
    detectionCount: 0,
    lastDetectedLanguage: "",
    audioQueue: [],
    bargeInTranscript: null,
    speechQueue: [],
    responseId: 1,
    currentLLMRequestId: 0,
    cancelCurrentResponse: false,
    interruptRequested: false,
  };

  session.silenceTimer = createSilenceTimer(session);

  SESSION_MAP.set(sessionId, session);
  console.log(`[Session] Initialized: ${sessionId}`);
  return session;
}

function createSilenceTimer(session: SessionState): NodeJS.Timeout {
  return setInterval(async () => {
    const now = Date.now();
    const lastAt = Math.max(session.lastInteractionAt || 0, session.lastSpeechAt || 0);

    if (
      !session.isAgentSpeaking &&
      !session.isProcessingSpeech &&
      !session.isUserSpeaking &&
      session.greetingPlayed &&
      session.languageLocked &&
      !session.bargeInDetected &&
      now - lastAt > 1000000
    ) {
      if (!session.silenceWarningSent) {
        session.silenceWarningSent = true;
        session.lastInteractionAt = now;

        const silencePrompts: Record<string, string> = {
          "en-IN": "Are you still there?",
          "hi-IN": "क्या आप अभी भी लाइन पर हैं?",
          "kn-IN": "ನೀವು ಇನ್ನೂ ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಾ?",
        };

        try {
          const prompt =
            silencePrompts[session.language as keyof typeof silencePrompts] ||
            silencePrompts["en-IN"];
          const rid = session.responseId || 0;
          await safeSpeak(session, rid, prompt);
        } catch (e) {
          console.error("[Silence Timer Error]", e);
        }
        return;
      }

      if (!session.silenceHangupSent && now - (session.lastInteractionAt || Date.now()) >= 20000) {
        session.silenceHangupSent = true;

        const hangupPrompts: Record<string, string> = {
          "en-IN": `I'll end the call now. Thank you for calling ${_hospitalNameForSilence()}.`,
          "hi-IN": `मैं अब कॉल समाप्त कर रहा हूँ। ${_hospitalNameForSilence()} को कॉल करने के लिए धन्यवाद।`,
          "kn-IN": `ನಾನು ಈಗ ಕರೆಯನ್ನು ಕೊನೆಗೊಳಿಸುತ್ತೇನೆ. ${_hospitalNameForSilence()} ಗೆ ಕರೆ ಮಾಡಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು.`,
        };

        try {
          const prompt =
            hangupPrompts[session.language as keyof typeof hangupPrompts] || hangupPrompts["en-IN"];
          const rid = session.responseId || 0;
          await safeSpeak(session, rid, prompt);
          await waitForExotelFlush(session);
          setTimeout(() => {
            try {
              session.ws?.close();
            } catch {}
          }, 1500);
        } catch (e) {
          console.error("[Silence Hangup Error]", e);
        }
      }
    }
  }, 1000);
}

function resetSilenceTimer(session: SessionState): void {
  if (session.silenceTimer) {
    clearInterval(session.silenceTimer);
  }
  session.silenceTimer = createSilenceTimer(session);
}

function sendAudioToTwilio(ws: WebSocket, streamSid: string, audioChunk: Buffer): void {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          event: "media",
          streamSid,
          media: {
            payload: audioChunk.toString("base64"),
          },
        }),
      );
    }
  } catch (error: any) {
    console.error("[Audio Send] Error:", error.message);
  }
}

function sendAudioToProvider(session: SessionState, audioChunk: Buffer): void {
  if (session.isEnding) {
    session.exotelOutBuffer = Buffer.alloc(0);
    return;
  }

  if (session.ws.readyState !== WebSocket.OPEN) {
    return;
  }

  if (!audioChunk || audioChunk.length === 0) {
    audioChunk = session.provider === "exotel" ? Buffer.alloc(3200) : Buffer.alloc(320);
  }

  if (session.provider === "exotel") {
    try {
      const prior = session.exotelOutBuffer || Buffer.alloc(0);
      session.exotelOutBuffer = Buffer.concat([prior, audioChunk]);
      const chunkSize = 3200;

      while ((session.exotelOutBuffer?.length || 0) >= chunkSize) {
        const out = session.exotelOutBuffer!.subarray(0, chunkSize);
        session.exotelOutBuffer = session.exotelOutBuffer!.subarray(chunkSize);
        session.outboundChunk += 1;

        let ts = Date.now() - session.startTime;
        if (session.lastTimestamp && ts <= session.lastTimestamp) {
          ts = session.lastTimestamp + 100;
        }
        session.lastTimestamp = ts;

        if (session.ws.readyState === WebSocket.OPEN) {
          session.ws.send(
            JSON.stringify({
              event: "media",
              stream_sid: session.sessionId,
              media: {
                payload: out.toString("base64"),
              },
            }),
          );
        }
      }
    } catch (error: any) {
      console.error("[Audio Send] Exotel error:", error.message);
    }
    return;
  }

  sendAudioToTwilio(session.ws, session.sessionId, audioChunk);
}

function sendMarkToProvider(session: SessionState, name: string): void {
  if (session.isEnding) return;

  if (session.provider === "exotel") {
    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(
        JSON.stringify({
          event: "mark",
          sequence_number: String(++session.outboundSequence),
          stream_sid: session.sessionId,
          mark: { name },
        }),
      );
    }
  } else if (session.provider === "twilio") {
    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(
        JSON.stringify({
          event: "mark",
          streamSid: session.sessionId,
          mark: { name },
        }),
      );
    }
  }
}

function clearProviderAudio(session: SessionState): void {
  if (session.provider === "exotel") {
    try {
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify({ event: "clear", stream_sid: session.sessionId }));
      }
    } catch (error: any) {
      console.error("[Audio Clear] Exotel error:", error.message);
    }
    return;
  }

  if (session.ws.readyState === WebSocket.OPEN) {
    session.ws.send(JSON.stringify({ event: "clear", streamSid: session.sessionId }));
  }
}

async function interruptCurrentResponse(session: SessionState) {
  if (!session) return;

  console.log("[BARGE-IN] Interrupting current AI response");

  session.bargeInDetected = true;
  session.cancelCurrentResponse = true;
  session.interruptRequested = true;
  session.isAgentSpeaking = false;
  session.isUserSpeaking = true;
  session.responseId = (session.responseId ?? 0) + 1;
  session.speechQueue = [];
  session.audioQueue = [];
  session.exotelOutBuffer = Buffer.alloc(0);
  clearProviderAudio(session);

  try {
    session.tts?.close();
  } catch {}

  console.log("[BARGE-IN] Current response cancelled");
}

function sendProviderKeepAlive(session: SessionState): void {
  if (session.provider !== "exotel") return;
  try {
    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(
        JSON.stringify({
          event: "mark",
          sequence_number: String(++session.outboundSequence),
          stream_sid: session.sessionId,
          mark: { name: `keepalive-${session.outboundSequence}` },
        }),
      );
    }
  } catch (error: any) {
    console.error("[KeepAlive] Exotel mark error:", error.message);
  }
}

function waitForExotelFlush(session: SessionState, maxMs = 1200): Promise<void> {
  return new Promise<void>((resolve) => {
    const start = Date.now();
    const check = () => {
      if ((session.exotelOutBuffer?.length || 0) === 0 || Date.now() - start > maxMs) {
        if (Date.now() - start > maxMs) {
          console.warn("[WaitForFlush] Timeout — forcing resolve");
        }
        resolve();
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

async function enqueueSpeech(session: SessionState, transcript: string) {
  console.log("✅ enqueueSpeech called");
  if (!transcript?.trim()) return;
  console.log("[QUEUE ENTRY]", {
    transcript,
    processing: session.isProcessingSpeech,
    queueLength: session.speechQueue?.length,
  });

  session.speechQueue ??= [];
  const last = session.speechQueue[session.speechQueue.length - 1];

  if (last === transcript) {
    console.log("[QUEUE] Duplicate skipped");
    return;
  }

  if (session.bargeInDetected) {
    session.speechQueue = [transcript];
  } else {
    session.speechQueue.push(transcript);
  }

  if (session.isProcessingSpeech) {
    return;
  }

  session.isProcessingSpeech = true;
  console.log("[QUEUE] Starting processing");

  try {
    while (session.speechQueue.length > 0) {
      const nextTranscript = session.speechQueue.shift();
      if (!nextTranscript) continue;

      try {
        console.log("[QUEUE] Processing:", nextTranscript);
        await processUserSpeech(session, nextTranscript);
      } catch (err) {
        console.error("[QUEUE ERROR]", err);
      }
    }
  } finally {
    session.isProcessingSpeech = false;
  }
}

async function safeSpeak(session: SessionState, responseId: number, text: string) {
  if (!session?.tts) return;
  if (session.isEnding) return;

  if (responseId !== session.responseId) {
    console.log("[SAFE SPEAK] Cancelled before speaking");
    return;
  }

  try {
    session.isAgentSpeaking = true;
    session.isUserSpeaking = false;
    session.cancelCurrentResponse = false;
    session.interruptRequested = false;
    session.bargeInDetected = false;

    await session.tts.speak(
      text,
      () =>
        !!session?.isEnding ||
        responseId !== session.responseId ||
        !!session?.bargeInDetected ||
        !!session?.cancelCurrentResponse ||
        !!session?.interruptRequested,
    );

    if (
      responseId !== session.responseId ||
      session.bargeInDetected ||
      session.isEnding ||
      session.cancelCurrentResponse ||
      session.interruptRequested
    ) {
      return;
    }

    session.lastSpeechAt = Date.now();

    // existing Prisma message-saving code...
  } catch (err) {
    console.error("[SAFE SPEAK ERROR]", err);
  }
}

async function processUserSpeech(session: SessionState, userText: string): Promise<void> {
  console.log("✅ processUserSpeech called");
  console.log("[PROCESS ENTRY]", {
    userText,
    languageLocked: session.languageLocked,
    language: session.language,
    processing: session.isProcessingSpeech,
  });
  if (session.isEnding) return;

  const transcript = userText.trim();
  if (isNoiseUtterance(transcript)) {
    return;
  }

  const currentResponseId = session.responseId || 0;

  // =============================
  // LANGUAGE SELECTION GATE
  // =============================
  if (!session.languageLocked) {
    const langText = transcript.toLowerCase();
    let selectedLang: SupportedLanguage = SupportedLanguage.EN;

    const normalizedLang = langText
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+/g, "")
      .trim()
      .toLowerCase();

    if (
      normalizedLang.includes("hindi") ||
      normalizedLang.includes("hindii") ||
      normalizedLang.includes("indi") ||
      normalizedLang.includes("indeed") ||
      normalizedLang.includes("hind") ||
      normalizedLang.includes("हिंदी")
    ) {
      selectedLang = SupportedLanguage.HI;
    } else if (
      normalizedLang.includes("kannada") ||
      normalizedLang.includes("canada") ||
      normalizedLang.includes("caneda") ||
      normalizedLang.includes("kanada") ||
      normalizedLang.includes("ಕನ್ನಡ")
    ) {
      selectedLang = SupportedLanguage.KN;
    } else if (normalizedLang.includes("english") || normalizedLang.includes("inglish")) {
      selectedLang = SupportedLanguage.EN;
    } else {
      const retryLanguagePrompt: Partial<Record<SupportedLanguage, string>> = {
        "en-IN": "Please say English, Hindi or Kannada.",
        "hi-IN": "कृपया English, Hindi या Kannada कहें।",
        "kn-IN": "ದಯವಿಟ್ಟು English, Hindi ಅಥವಾ Kannada ಎಂದು ಹೇಳಿ.",
      };

      const answer = retryLanguagePrompt[session.language] ?? retryLanguagePrompt["en-IN"]!;
      await safeSpeak(session, currentResponseId, answer);
      return;
    }

    console.log("[Language Selected]", selectedLang);
    session.language = selectedLang;

    try {
      session.tts?.close();

      session.tts = new CartesiaLiveTTS(
        process.env.CARTESIA_VOICE_ID || "",
        selectedLang,
        (chunk) => sendAudioToProvider(session!, chunk),
        () => sendMarkToProvider(session!, "response-complete"),
        (error) => console.error("[TTS] Error:", error),
        session.provider === "exotel" ? "pcm16le8k" : "mulaw8k",
      );

      if (session.stt) {
        console.log("[Language] Restarting STT...");
        session.stt
          .changeLanguage(selectedLang)
          .then(() => console.log("[Language] STT restarted"))
          .catch((err) => console.error("[Language] STT restart failed", err));
      }

      session.languageLocked = true;
      session.lastInteractionAt = Date.now();
      session.lastSpeechAt = Date.now();
      session.silenceWarningSent = false;
      session.silenceHangupSent = false;
      session.speechQueue = [];
      session.isUserSpeaking = false;
      session.bargeInDetected = false;
      resetSilenceTimer(session);
      console.log("[Language] Locked:", session.language);

      const greetingByLanguage: Record<string, string> = {
        "en-IN":
          "Thank you. Would you like to book an appointment, connect to emergency, or connect to the receptionist?",
        "hi-IN":
          "धन्यवाद। क्या आप अपॉइंटमेंट बुक करना चाहेंगे, इमरजेंसी से जुड़ना चाहेंगे, या रिसेप्शनिस्ट से बात करना चाहेंगे?",
        "kn-IN":
          "ಧನ್ಯವಾದಗಳು. ನೀವು ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬುಕ್ ಮಾಡಲು ಬಯಸುವಿರಾ, ತುರ್ತು ವಿಭಾಗಕ್ಕೆ ಸಂಪರ್ಕಿಸಲು ಬಯಸುವಿರಾ, ಅಥವಾ ರಿಸೆಪ್ಷನಿಸ್ಟ್ ಜೊತೆ ಮಾತನಾಡಲು ಬಯಸುವಿರಾ?",
      };
      const greeting = greetingByLanguage[session.language] || greetingByLanguage["en-IN"];
      await safeSpeak(session, currentResponseId, greeting);
      return;
    } catch (err) {
      console.error("[Language Selection Error]", err);
    }

    return;
  }

  // =============================
  // AGENT TURN (Planner-driven)
  // =============================
  try {
    await handleAgentTurn(session, transcript, {
      speak: (text: string) => safeSpeak(session, currentResponseId, text),
      endCall: (delayMs?: number) => {
        setTimeout(() => {
          try {
            session.ws?.close();
          } catch {}
        }, delayMs ?? 1000);
      },
    });
  } catch (error) {
    console.error("[AgentTurn] Error:", error);
    await safeSpeak(
      session,
      currentResponseId,
      "I'm sorry, I'm having trouble understanding right now. Could you please try again?",
    );
    return;
  }

  session.lastInteractionAt = Date.now();
  session.lastSpeechAt = Date.now();
  session.silenceWarningSent = false;
  session.silenceHangupSent = false;
  session.fullTranscript += `\nUser: ${transcript}`;
}

async function endCall(session: SessionState): Promise<void> {
  if (session.isEnding) return;
  session.isEnding = true;

  if (session.silenceTimer) {
    clearInterval(session.silenceTimer);
    session.silenceTimer = undefined;
  }

  if (session.sttWatchdogTimer) {
    clearTimeout(session.sttWatchdogTimer);
    session.sttWatchdogTimer = undefined;
  }

  console.log(`[Call] Ending: ${session.callSid}`);
  if (session.heartbeatTimer) {
    clearInterval(session.heartbeatTimer);
    session.heartbeatTimer = undefined;
  }

  if (session.stt) {
    try {
      await session.stt.stop();
    } catch (e) {
      console.error("[STT Stop] Error:", e);
    }
  }

  if (session.tts) {
    try {
      session.tts.close();
    } catch (e) {
      console.error("[TTS Close] Error:", e);
    }
  }

  if (
    session.provider === "exotel" &&
    session.exotelOutBuffer &&
    session.exotelOutBuffer.length > 0
  ) {
    const minSize = 3200;
    const multiple = 320;
    let out = session.exotelOutBuffer;
    if (out.length < minSize) {
      out = Buffer.concat([out, Buffer.alloc(minSize - out.length)]);
    } else if (out.length % multiple !== 0) {
      out = Buffer.concat([out, Buffer.alloc(multiple - (out.length % multiple))]);
    }
    session.outboundSequence += 1;
    session.outboundChunk += 1;
    try {
      let ts = Date.now() - session.startTime;
      if (session.lastTimestamp && ts <= session.lastTimestamp) {
        ts = session.lastTimestamp + 100;
      }
      session.lastTimestamp = ts;

      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(
          JSON.stringify({
            event: "media",
            stream_sid: session.sessionId,
            media: {
              payload: out.toString("base64"),
            },
          }),
        );
      }
    } catch (flushError) {
      console.error("[Exotel Flush] Error:", flushError);
    }
    session.exotelOutBuffer = Buffer.alloc(0);
  }

  SESSION_MAP.delete(session.sessionId);
  console.log(`[Session] Cleaned up: ${session.sessionId}`);
}

export async function handleWebSocketMessage(ws: WebSocket, data: Buffer | string): Promise<void> {
  try {
    chunkLogStream.write(`[${new Date().toISOString()}] Chunk size: ${(data as any).length}\n`);
    const rawMessage = typeof data === "string" ? data : data.toString();
    const message = JSON.parse(rawMessage);
    const event = message.event;
    const resolvedStreamSid =
      message.streamSid ||
      message.stream_sid ||
      message.start?.streamSid ||
      message.start?.stream_sid;
    let session = resolvedStreamSid ? SESSION_MAP.get(resolvedStreamSid) : undefined;

    switch (event) {
      case "connected":
        console.log("[WS] Connected event received");
        break;

      case "start": {
        const startPayload = message.start || {};
        const streamSid =
          startPayload.streamSid ||
          startPayload.stream_sid ||
          message.streamSid ||
          message.stream_sid;
        const callSid = startPayload.callSid || startPayload.call_sid || "";
        const params = startPayload.customParameters || startPayload.custom_parameters || {};
        const provider: "twilio" | "exotel" =
          startPayload.stream_sid || message.stream_sid ? "exotel" : "twilio";
        let organizationId =
          params.organizationId ||
          params.organization_id ||
          process.env.DEFAULT_ORGANIZATION_ID ||
          "default";
        let agentId = params.agentId || params.agent_id || "";
        let conversationId: string | undefined =
          params.conversationId || params.conversation_id || undefined;
        const language = params.language || params.lang || SupportedLanguage.EN;
        let direction =
          params.direction || params.callType || (provider === "exotel" ? "INBOUND" : "INBOUND");
        direction = direction.toUpperCase();
        let calledNumber = params.calledNumber || params.to || startPayload.to || "";
        let callerNumber = params.callerNumber || params.from || startPayload.from || "";

        let recoveredLeadId: string | undefined;
        if ((!organizationId || !agentId) && callSid) {
          if ((!organizationId || !agentId || !conversationId) && callSid) {
            try {
              const existingConversation = await prisma.conversation.findUnique({
                where: { twilioCallSid: callSid },
                select: {
                  id: true,
                  organizationId: true,
                  agentId: true,
                  callDirection: true,
                  phoneFrom: true,
                  phoneTo: true,
                  leadId: true,
                },
              });

              if (existingConversation) {
                organizationId ||= existingConversation.organizationId;
                agentId ||= existingConversation.agentId;
                conversationId ||= existingConversation.id;
                direction = existingConversation.callDirection || direction;
                callerNumber ||= existingConversation.phoneFrom || callerNumber;
                calledNumber ||= existingConversation.phoneTo || calledNumber;
                recoveredLeadId = existingConversation.leadId || undefined;
                console.log("[WS START] Recovered conversation metadata from DB", {
                  callSid,
                  organizationId,
                  conversationId,
                  agentId,
                  direction,
                  leadId: recoveredLeadId,
                });
              }
            } catch (dbError: any) {
              console.error("[WS START] Failed to recover conversation metadata:", dbError);
            }
          }
          if (!conversationId) {
            console.warn(
              "[WS START] No conversationId available for this call — transcript will not be persisted",
              { callSid },
            );
          }

          // Check for orphan media
          const orphan = ORPHAN_MEDIA_MAP.get(streamSid);
          if (orphan) {
            console.log(
              `[Session] Found ${orphan.chunks.length} orphan audio chunks for ${streamSid}`,
            );
          }
          ORPHAN_MEDIA_MAP.delete(streamSid);

          session = initializeSession(ws, {
            streamSid,
            callSid,
            organizationId,
            language,
            provider,
          });

          if (orphan) {
            session.audioQueue = orphan.chunks;
          }

          session.callerNumber = callerNumber;
          session.conversationId = conversationId;
          if (recoveredLeadId) {
            session.leadId = recoveredLeadId;
          }

          // Initialize TTS first
          try {
            session.tts = new CartesiaLiveTTS(
              process.env.CARTESIA_VOICE_ID || "",
              session.language,
              (chunk) => sendAudioToProvider(session!, chunk),
              () => sendMarkToProvider(session!, "response-complete"),
              (error) => console.error("[TTS] Error:", error),
              session.provider === "exotel" ? "pcm16le8k" : "mulaw8k",
            );
          } catch (error: any) {
            console.error("[TTS] Failed to initialize:", error?.message || error);
            session.tts = null;
          }

          // Play language selection prompt
          const _hospitalName = process.env.HOSPITAL_NAME || "Suncoast Hospital";
          const langPrompt = `Welcome to ${_hospitalName}. Which language are you comfortable with? English, Hindi or Kannada?`;
          const rid = session.responseId || 0;
          await safeSpeak(session, rid, langPrompt);
          session.greetingPlayed = true;
          session.lastInteractionAt = Date.now();

          // Initialize STT
          session.stt = new DeepgramLiveSTT(
            async (event) => {
              const transcript = event.transcript?.trim();
              if (!transcript || transcript.length < 2) return;
              if (!session) return;

              const noise = isNoiseUtterance(transcript, event.confidence);
              console.log({ transcript, confidence: event.confidence, noise });

              if (event.isFinal && noise) {
                console.log("[NOISE FILTER]");
                return;
              }

              console.log(`🧠 STT (${event.isFinal ? "FINAL" : "INTERIM"}): ${transcript}`);

              if (
                !event.isFinal &&
                session.isAgentSpeaking &&
                !session.bargeInDetected &&
                !noise &&
                transcript.length > 2 &&
                (event.confidence === undefined || event.confidence >= 0.5)
              ) {
                console.log("[BARGE-IN] First interim detected");
                await interruptCurrentResponse(session);
                await enqueueSpeech(session, transcript);
                return;
              }

              if (event.isFinal) {
                console.log("[STT] Final transcript, enqueuing");
                await enqueueSpeech(session, transcript);
              }
            },
            (error: Error) => console.error("[STT Error]", error),
            {
              language: session.language,
              encoding: session.provider === "exotel" ? "linear16" : "mulaw",
              sampleRate: 8000,
            },
            () => {
              if (!session) return;
              console.log("[STT] Ready");
              session.sttReady = true;
              if (session.audioQueue.length > 0) {
                console.log(`[AudioQueue] Flushing ${session.audioQueue.length} queued chunks`);
                while (session.audioQueue.length > 0) {
                  const chunk = session.audioQueue.shift();
                  if (chunk && session.stt) {
                    session.stt
                      .sendAudio(chunk)
                      .catch((err) => console.error("[STT Send Audio Error]", err));
                  }
                }
              }
            },
          );

          await session.stt.start();

          if (session.provider === "exotel") {
            session.heartbeatTimer = setInterval(() => {
              sendProviderKeepAlive(session!);
            }, 15000);
          }

          break;
        }
      }

      case "media": {
        const streamSid =
          message.streamSid ||
          message.stream_sid ||
          message.start?.streamSid ||
          message.start?.stream_sid;

        if (!session && streamSid) {
          // Handle orphan media (audio arriving before 'start' event)
          let orphan = ORPHAN_MEDIA_MAP.get(streamSid);
          if (!orphan) {
            orphan = { chunks: [], timestamp: Date.now() };
            ORPHAN_MEDIA_MAP.set(streamSid, orphan);

            // Auto-cleanup orphans after 10 seconds
            setTimeout(() => ORPHAN_MEDIA_MAP.delete(streamSid), 10000);
          }

          const audioPayload = message.media?.payload;
          if (audioPayload) {
            orphan.chunks.push(Buffer.from(audioPayload, "base64"));
          }
          return;
        }

        if (!session) return;

        const audioPayload = message.media?.payload;

        if (!audioPayload || typeof audioPayload !== "string") {
          console.log("❌ Invalid audio payload");
          break;
        }

        const track = message.media?.track;
        if (track && track !== "inbound") {
          break;
        }

        let audioBuffer: Buffer;
        try {
          audioBuffer = Buffer.from(audioPayload, "base64");
          if (process.env.DEBUG_MEDIA === "true") {
            console.log(`[MEDIA] decoded=${audioBuffer.length} bytes sttReady=${session.sttReady}`);
          }
        } catch {
          console.log("❌ Failed to decode base64");
          break;
        }

        // Buffer if STT not ready
        if (!session.sttReady || !session.stt) {
          session.audioQueue.push(audioBuffer);
          return;
        }

        // Proper buffering for Exotel
        session.exotelInBuffer = session.exotelInBuffer || Buffer.alloc(0);
        session.exotelInBuffer = Buffer.concat([session.exotelInBuffer, audioBuffer]);

        const TARGET_CHUNK = session.provider === "exotel" ? 640 : 320;

        while (session.exotelInBuffer.length >= TARGET_CHUNK) {
          const chunk = session.exotelInBuffer.subarray(0, TARGET_CHUNK);
          session.exotelInBuffer = session.exotelInBuffer.subarray(TARGET_CHUNK);

          // Prevent bot voice loopback but preserve caller interruption audio
          // if (session.isAgentSpeaking && !session.bargeInDetected) {
          //   if (session.audioQueue.length < 200) {
          //     session.audioQueue.push(chunk);
          //   }
          //   continue;
          // }

          await session.stt.sendAudio(chunk);
        }

        break;
      }

      case "stop": {
        console.log("[WS STOP]", message.stop || {});
        if (session) {
          await endCall(session);
        }
        break;
      }

      case "dtmf": {
        console.log("[WS DTMF]", message.dtmf || {});
        break;
      }

      case "mark": {
        const markName = message.mark?.name;
        console.log("[WS MARK ACK]", markName);

        if (!session) break;

        if (markName?.startsWith("audio-")) {
          console.log(`✅ Chunk played: ${markName}`);
        }

        if (markName === "response-complete") {
          session.isAgentSpeaking = false;
          session.bargeInDetected = false;
          console.log("✅ Playback completed for full response");
        }

        break;
      }

      default:
        console.log("[WS] Unknown event:", event);
    }
  } catch (error: any) {
    console.error("[WebSocket] Error processing message:", error);
  }
}

/**
 * Handle WebSocket connection
 */
export async function handleWebSocketConnection(ws: WebSocket, req: any): Promise<void> {
  console.log("[WebSocket] New connection", {
    path: req?.url,
    remoteAddress: req?.socket?.remoteAddress,
    userAgent: req?.headers?.["user-agent"],
  });

  ws.on("message", (data: Buffer | string) => {
    handleWebSocketMessage(ws, data).catch((error) => {
      console.error("[Message Handler] Error:", error);
    });
  });

  ws.on("close", () => {
    console.log("[WebSocket] Connection closed");
    // Clean up any remaining sessions
    for (const [sessionId, session] of SESSION_MAP.entries()) {
      if (session.ws === ws) {
        endCall(session).catch((error) => {
          console.error("[Cleanup] Error:", error);
        });
        SESSION_MAP.delete(sessionId);
      }
    }
  });
  ws.on("error", (error: any) => {
    console.error("[WebSocket Error]", error);
  });
}
