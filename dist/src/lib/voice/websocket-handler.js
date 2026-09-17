/**
 * Twilio Media Streams WebSocket Handler
 * Orchestrates: Deepgram STT → Groq Brain → Azure TTS
 * Handles streaming audio, barge-in detection, language detection
 * Production-ready with error handling and logging
 */
import WebSocket from "ws";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DeepgramLiveSTT } from "./deepgram-stt";
import * as chrono from "chrono-node";
// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const chunkLogStream = fs.createWriteStream(path.resolve(__dirname, "../../../chunks.log"), {
    flags: "a",
});
import { SarvamLiveTTS } from "./sarvam-tts";
import { GroqDualBrain } from "./groq-brain";
import { detectLanguage, isEmergency, isNoiseUtterance, getSarvamVoiceId, SupportedLanguage, } from "./language-detection";
import { prisma } from "../prisma";
import { sendSMSMessage } from "../communications/index";
import { sendEmail } from "../email";
import { handleAgentTurn } from "../../ai/conversation/agent-turn";
import { getAgentService } from "../../ai/agent/agent.service";
const SESSION_MAP = new Map();
export const CALL_INTENT_MAP = new Map();
const FLOW_TEXT = {
    askName: {
        "en-IN": "May I have your full name?",
        "hi-IN": "क्या मैं आपका पूरा नाम जान सकता हूँ?",
        "kn-IN": "ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರನ್ನು ತಿಳಿಸಬಹುದೇ?",
    },
    confirmName: {
        "en-IN": 'I heard "{value}". Is that correct?',
        "hi-IN": 'मैंने "{value}" सुना। क्या यह सही है?',
        "kn-IN": 'ನಾನು "{value}" ಎಂದು ಕೇಳಿದೆ. ಅದು ಸರಿಯೇ?',
    },
    retryName: {
        "en-IN": "Could you tell me your name again?",
        "hi-IN": "क्या आप अपना नाम फिर से बता सकते हैं?",
        "kn-IN": "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹೆಸರನ್ನು ಮತ್ತೆ ಹೇಳಬಹುದೇ?",
    },
    askPhone: {
        "en-IN": "May I have your mobile number?",
        "hi-IN": "क्या मैं आपका मोबाइल नंबर जान सकता हूँ?",
        "kn-IN": "ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ತಿಳಿಸಬಹುದೇ?",
    },
    invalidPhone: {
        "en-IN": "Could you share a valid ten-digit mobile number?",
        "hi-IN": "क्या आप एक सही दस अंकों का मोबाइल नंबर बता सकते हैं?",
        "kn-IN": "ದಯವಿಟ್ಟು ಸರಿಯಾದ ಹತ್ತು ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ಹೇಳಬಹುದೇ?",
    },
    confirmPhone: {
        "en-IN": 'I heard "{value}". Is that correct?',
        "hi-IN": 'मैंने "{value}" सुना। क्या यह सही है?',
        "kn-IN": 'ನಾನು "{value}" ಎಂದು ಕೇಳಿದೆ. ಅದು ಸರಿಯೇ?',
    },
    retryPhone: {
        "en-IN": "Could you tell me your mobile number again?",
        "hi-IN": "क्या आप अपना मोबाइल नंबर फिर से बता सकते हैं?",
        "kn-IN": "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ಮತ್ತೆ ಹೇಳಬಹುದೇ?",
    },
    askEmail: {
        "en-IN": "May I have your email address?",
        "hi-IN": "क्या मैं आपका ईमेल पता जान सकता हूँ?",
        "kn-IN": "ನಿಮ್ಮ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ತಿಳಿಸಬಹುದೇ?",
    },
    invalidEmail: {
        "en-IN": "Could you share a valid email address?",
        "hi-IN": "क्या आप एक सही ईमेल पता बता सकते हैं?",
        "kn-IN": "ದಯವಿಟ್ಟು ಸರಿಯಾದ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ಹೇಳಬಹುದೇ?",
    },
    confirmEmail: {
        "en-IN": 'I heard "{value}". Is that correct?',
        "hi-IN": 'मैंने "{value}" सुना। क्या यह सही है?',
        "kn-IN": 'ನಾನು "{value}" ಎಂದು ಕೇಳಿದೆ. ಅದು ಸರಿಯೇ?',
    },
    retryEmail: {
        "en-IN": "Could you tell me your email address again?",
        "hi-IN": "क्या आप अपना ईमेल पता फिर से बता सकते हैं?",
        "kn-IN": "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ಮತ್ತೆ ಹೇಳಬಹುದೇ?",
    },
    askDepartment: {
        "en-IN": "Which department or doctor would you like to see?",
        "hi-IN": "आप किस विभाग या डॉक्टर से मिलना चाहेंगे?",
        "kn-IN": "ನೀವು ಯಾವ ವಿಭಾಗ ಅಥವಾ ವೈದ್ಯರನ್ನು ಭೇಟಿ ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?",
    },
    askSymptoms: {
        "en-IN": "Would you like to describe your symptoms?",
        "hi-IN": "क्या आप अपने लक्षण बताना चाहेंगे?",
        "kn-IN": "ನಿಮ್ಮ ಲಕ್ಷಣಗಳನ್ನು ವಿವರಿಸಲು ಬಯಸುವಿರಾ?",
    },
    askDate: {
        "en-IN": "What date and time would be convenient for your appointment?",
        "hi-IN": "आपकी अपॉइंटमेंट के लिए कौन सी तारीख और समय सुविधाजनक रहेगा?",
        "kn-IN": "ನಿಮ್ಮ ಅಪಾಯಿಂಟ್ಮೆಂಟ್‌ಗೆ ಯಾವ ದಿನಾಂಕ ಮತ್ತು ಸಮಯ ಅನುಕೂಲಕರವಾಗಿರುತ್ತದೆ?",
    },
    invalidDate: {
        "en-IN": "Please provide a valid appointment date.",
        "hi-IN": "कृपया सही अपॉइंटमेंट तारीख बताएं।",
        "kn-IN": "ದಯವಿಟ್ಟು ಸರಿಯಾದ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ದಿನಾಂಕವನ್ನು ತಿಳಿಸಿ.",
    },
    pastDate: {
        "en-IN": "Appointment date cannot be in the past. Please provide a future date.",
        "hi-IN": "अपॉइंटमेंट की तारीख पिछली नहीं हो सकती। कृपया भविष्य की तारीख बताएं।",
        "kn-IN": "ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ದಿನಾಂಕ ಹಿಂದಿನದಾಗಿರಬಾರದು. ದಯವಿಟ್ಟು ಭವಿಷ್ಯದ ದಿನಾಂಕವನ್ನು ತಿಳಿಸಿ.",
    },
    appointmentConfirmed: {
        "en-IN": "Your appointment has been noted. Please be at the hospital 15 minutes before your scheduled appointment time. Our team will confirm this shortly. Thank you for contacting us.",
        "hi-IN": "आपकी अपॉइंटमेंट दर्ज कर ली गई है। कृपया निर्धारित समय से 15 मिनट पहले अस्पताल पहुंचें। हमारी टीम शीघ्र ही पुष्टि करेगी। धन्यवाद।",
        "kn-IN": "ನಿಮ್ಮ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ದಾಖಲಾಗಿದೆ. ದಯವಿಟ್ಟು ನಿಗದಿತ ಸಮಯಕ್ಕಿಂತ 15 ನಿಮಿಷ ಮುಂಚಿತವಾಗಿ ಆಸ್ಪತ್ರೆಗೆ ಬನ್ನಿ. ನಮ್ಮ ತಂಡ ಶೀಘ್ರದಲ್ಲೇ ದೃಢೀಕರಿಸುತ್ತದೆ. ಧನ್ಯವಾದಗಳು.",
    },
    retryAppointmentDate: {
        "en-IN": "Okay. Please tell me your preferred appointment date and time again.",
        "hi-IN": "ठीक है। कृपया अपनी अपॉइंटमेंट की तारीख और समय फिर से बताएं।",
        "kn-IN": "ಸರಿ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ದಿನಾಂಕ ಮತ್ತು ಸಮಯವನ್ನು ಮತ್ತೆ ತಿಳಿಸಿ.",
    },
    confirmAppointment: {
        "en-IN": "Would you like to confirm this appointment for {department} on {date}?",
        "hi-IN": "क्या आप {date} को {department} विभाग के लिए यह अपॉइंटमेंट कन्फर्म करना चाहेंगे?",
        "kn-IN": "{date} ರಂದು {department} ವಿಭಾಗಕ್ಕೆ ಈ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಅನ್ನು ದೃಢೀಕರಿಸಲು ಬಯಸುವಿರಾ?",
    },
    appointmentRecall: {
        "en-IN": "Your appointment for {department} is confirmed for {date}.",
        "hi-IN": "{department} विभाग के लिए आपकी अपॉइंटमेंट {date} को निर्धारित है।",
        "kn-IN": "{department} ವಿಭಾಗದ ನಿಮ್ಮ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ {date} ರಂದು ದೃಢೀಕರಿಸಲಾಗಿದೆ.",
    },
};
function getFlowText(key, language) {
    const texts = FLOW_TEXT[key];
    return texts[language] || texts["en-IN"];
}
const YES_PATTERN = /(yes|yeah|correct|right|yep|confirmed|that's correct|okay|continue|go ahead|haan|haanji|ji|sahi|हाँ|हां|हौ|ಹೌದು|ಸರಿ|అవును|ஆம்|അതെ)/i;
const NO_PATTERN = /(no|nope|wrong|incorrect|not correct|change|nahi|galat|ಅಲ್ಲ|ತಪ್ಪು|नहीं|नाही)/i;
function isConfirmationYes(text) {
    return YES_PATTERN.test(text.toLowerCase());
}
function isConfirmationNo(text) {
    return NO_PATTERN.test(text.toLowerCase());
}
/** Lock language after detection — updates STT, TTS, and brain */
async function lockDetectedLanguage(session, detectedLang) {
    if (session.languageLocked || detectedLang === session.language) {
        if (!session.languageLocked) {
            session.language = detectedLang;
            session.languageLocked = true;
        }
        return;
    }
    console.log(`[Language] Locked language: ${detectedLang}`);
    session.language = detectedLang;
    session.languageLocked = true;
    try {
        session.tts?.close();
        session.tts = new SarvamLiveTTS(getSarvamVoiceId(detectedLang), (chunk) => sendAudioToProvider(session, chunk), undefined, (error) => console.error("[TTS] Error:", error), session.provider === "exotel" ? "pcm16le8k" : "mulaw8k");
        console.log(`[TTS] Reinitialized for ${detectedLang}`);
    }
    catch (ttsError) {
        console.error("[TTS Recreate Error]", ttsError);
    }
    session.brain?.changeLanguage(detectedLang);
    if (session.stt) {
        await session.stt.changeLanguage(detectedLang);
    }
}
const ORPHAN_MEDIA_MAP = new Map();
function _hospitalNameForSilence() {
    return process.env.HOSPITAL_NAME || "the hospital";
}
/**
 * Initialize WebSocket connection for a call
 */
function initializeSession(ws, callData) {
    const sessionId = callData.streamSid;
    // Create session state
    const session = {
        ws,
        sessionId,
        callSid: callData.callSid,
        organizationId: callData.organizationId,
        language: callData.language || SupportedLanguage.EN,
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
        step: "main_menu",
        speechQueue: [],
        responseId: 1,
        currentLLMRequestId: 0,
        cancelCurrentResponse: false,
        interruptRequested: false,
    };
    // Check for orphan media
    const orphan = ORPHAN_MEDIA_MAP.get(sessionId);
    if (orphan) {
        console.log(`[Session] Found ${orphan.chunks.length} orphan audio chunks for ${sessionId}`);
        session.audioQueue = orphan.chunks;
        ORPHAN_MEDIA_MAP.delete(sessionId);
    }
    SESSION_MAP.set(sessionId, session);
    //session.lastInteractionAt = Date.now();
    session.silenceTimer = setInterval(async () => {
        const now = Date.now();
        const APPOINTMENT_STEPS = [
            "ask_name",
            "confirm_name",
            "ask_phone",
            "confirm_phone",
            "ask_email",
            "confirm_email",
            "ask_department",
            "ask_symptoms",
            "ask_date",
            "confirm",
            "completed",
        ];
        if (APPOINTMENT_STEPS.includes(session.step || "")) {
            return;
        }
        if (!session.isAgentSpeaking &&
            !session.isProcessingSpeech &&
            !session.isUserSpeaking &&
            session.greetingPlayed &&
            session.languageLocked &&
            !session.bargeInDetected &&
            session.step !== "language_selection" &&
            now - (session.lastInteractionAt || Date.now()) > 10000) {
            if (!session.silenceWarningSent) {
                session.silenceWarningSent = false;
                session.lastInteractionAt = now;
                const silencePrompts = {
                    "en-IN": "Are you still there?",
                    "hi-IN": "क्या आप अभी भी लाइन पर हैं?",
                    "kn-IN": "ನೀವು ಇನ್ನೂ ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಾ?",
                };
                try {
                    const prompt = silencePrompts[session.language] ||
                        silencePrompts["en-IN"];
                    const rid = session.responseId || 0;
                    await safeSpeak(session, rid, prompt);
                }
                catch (e) {
                    console.error("[Silence Timer Error]", e);
                }
                return;
            }
            if (!session.silenceHangupSent && now - (session.lastInteractionAt || Date.now()) >= 20000) {
                session.silenceHangupSent = false;
                const hangupPrompts = {
                    "en-IN": `I'll end the call now. Thank you for calling ${_hospitalNameForSilence()}.`,
                    "hi-IN": `मैं अब कॉल समाप्त कर रहा हूँ। ${_hospitalNameForSilence()} को कॉल करने के लिए धन्यवाद।`,
                    "kn-IN": `ನಾನು ಈಗ ಕರೆಯನ್ನು ಕೊನೆಗೊಳಿಸುತ್ತೇನೆ. ${_hospitalNameForSilence()} ಗೆ ಕರೆ ಮಾಡಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು.`,
                };
                try {
                    const prompt = hangupPrompts[session.language] ||
                        hangupPrompts["en-IN"];
                    const rid = session.responseId || 0;
                    await safeSpeak(session, rid, prompt);
                    await waitForExotelFlush(session);
                    setTimeout(() => {
                        try {
                            session.ws?.close();
                        }
                        catch { }
                    }, 1500);
                }
                catch (e) {
                    console.error("[Silence Hangup Error]", e);
                }
            }
        }
    }, 1000);
    console.log(`[Session] Initialized: ${sessionId}`);
    return session;
}
/**
 * Send audio to Twilio Media Streams
 */
function sendAudioToTwilio(ws, streamSid, audioChunk) {
    try {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                event: "media",
                streamSid,
                media: {
                    payload: audioChunk.toString("base64"),
                },
            }));
        }
    }
    catch (error) {
        console.error("[Audio Send] Error:", error.message);
    }
}
function sendAudioToProvider(session, audioChunk) {
    // STRICT CHECK: Stop sending if call is ending
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
            // Exotel minimum is 100ms. For 8kHz PCM16, 100ms = 3200 bytes.
            const chunkSize = 3200;
            while ((session.exotelOutBuffer?.length || 0) >= chunkSize) {
                const out = session.exotelOutBuffer.subarray(0, chunkSize);
                session.exotelOutBuffer = session.exotelOutBuffer.subarray(chunkSize);
                session.outboundChunk += 1;
                // console.log(`🔊 Sending chunk ${session.outboundChunk} to Exotel (${out.length}B)`);
                let ts = Date.now() - session.startTime;
                if (session.lastTimestamp && ts <= session.lastTimestamp) {
                    ts = session.lastTimestamp + 100;
                }
                session.lastTimestamp = ts;
                if (session.ws.readyState === WebSocket.OPEN) {
                    session.ws.send(JSON.stringify({
                        event: "media",
                        stream_sid: session.sessionId,
                        media: {
                            payload: out.toString("base64"),
                        },
                    }));
                }
            }
            // 🔥 Flush leftover small buffer
        }
        catch (error) {
            console.error("[Audio Send] Exotel error:", error.message);
        }
        return;
    }
    sendAudioToTwilio(session.ws, session.sessionId, audioChunk);
}
/**
 * Send mark event to provider
 */
function sendMarkToProvider(session, name) {
    if (session.isEnding)
        return;
    if (session.provider === "exotel") {
        if (session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(JSON.stringify({
                event: "mark",
                sequence_number: String(++session.outboundSequence),
                stream_sid: session.sessionId,
                mark: { name },
            }));
        }
    }
    else if (session.provider === "twilio") {
        if (session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(JSON.stringify({
                event: "mark",
                streamSid: session.sessionId,
                mark: { name },
            }));
        }
    }
}
/**
 * Clear Twilio audio immediately (for barge-in)
 */
function clearTwilioAudio(ws, streamSid) {
    try {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: "clear", streamSid }));
        }
    }
    catch (error) {
        console.error("[Audio Clear] Error:", error.message);
    }
}
function clearProviderAudio(session) {
    if (session.provider === "exotel") {
        try {
            if (session.ws.readyState === WebSocket.OPEN) {
                session.ws.send(JSON.stringify({ event: "clear", stream_sid: session.sessionId }));
            }
        }
        catch (error) {
            console.error("[Audio Clear] Exotel error:", error.message);
        }
        return;
    }
    clearTwilioAudio(session.ws, session.sessionId);
}
async function interruptCurrentResponse(session) {
    if (!session)
        return;
    console.log("[BARGE-IN] Interrupting current AI response");
    // Stop current response
    session.bargeInDetected = true;
    session.cancelCurrentResponse = true;
    session.interruptRequested = true;
    session.isAgentSpeaking = false;
    session.isUserSpeaking = true;
    // Invalidate every running response
    session.responseId = (session.responseId ?? 0) + 1;
    // Clear queued user speech
    session.speechQueue = [];
    // Clear outbound audio
    session.audioQueue = [];
    session.exotelOutBuffer = Buffer.alloc(0);
    // Flush provider playback
    clearProviderAudio(session);
    // Stop current TTS immediately
    try {
        session.tts?.close();
    }
    catch { }
    console.log("[BARGE-IN] Current response cancelled");
}
function sendProviderKeepAlive(session) {
    if (session.provider !== "exotel")
        return;
    try {
        if (session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(JSON.stringify({
                event: "mark",
                sequence_number: String(++session.outboundSequence),
                stream_sid: session.sessionId,
                mark: {
                    name: `keepalive-${session.outboundSequence}`,
                },
            }));
        }
    }
    catch (error) {
        console.error("[KeepAlive] Exotel mark error:", error.message);
    }
}
/**
 * Wait for Exotel outbound buffer to fully drain before sending mark events.
 * Only relevant for Exotel — Twilio resolves instantly (buffer is always empty).
 */
function waitForExotelFlush(session, maxMs = 1200) {
    return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
            if ((session.exotelOutBuffer?.length || 0) === 0 || Date.now() - start > maxMs) {
                if (Date.now() - start > maxMs) {
                    console.warn("[WaitForFlush] Timeout — forcing resolve");
                }
                resolve();
            }
            else {
                setTimeout(check, 10);
            }
        };
        check();
    });
}
/**
 * Simple Intent Detection (Production-ready)
 */
function detectIntent(message) {
    const msg = message.toLowerCase();
    if (msg.includes("appointment") || msg.includes("book"))
        return "appointment";
    if (msg.includes("pain") || msg.includes("fever") || msg.includes("symptom"))
        return "triage";
    if (msg.includes("medicine") || msg.includes("tablet"))
        return "pharmacist";
    if (msg.includes("which doctor"))
        return "consultant";
    if (msg.includes("summarize"))
        return "scribe";
    return "general";
}
function extractEmail(text) {
    const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0].toLowerCase() : null;
}
function extractContactName(text) {
    const match = text.match(/(?:my name is|i am|i'm|this is)\s+([A-Za-z][A-Za-z\s.'-]{1,80})/i);
    if (!match)
        return null;
    const name = match[1].trim().replace(/[.,!?]$/, "");
    return name.length > 0 ? name : null;
}
function splitFullName(fullName) {
    const parts = fullName.trim().split(/\s+/);
    return {
        firstName: parts[0] ?? undefined,
        lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
    };
}
async function findOrCreateLeadForSession(session, organizationId) {
    const phone = session.callerNumber?.trim() || undefined;
    const email = session.contactEmail?.trim().toLowerCase();
    const name = session.appointmentData?.patientName || session.contactName;
    if (!phone && !email)
        return null;
    const leadWhere = phone ? { organizationId, phone } : email ? { organizationId, email } : null;
    let lead = null;
    if (leadWhere) {
        lead = await prisma.lead.findFirst({ where: leadWhere });
    }
    const fullName = name?.trim();
    const { firstName, lastName } = fullName
        ? splitFullName(fullName)
        : { firstName: undefined, lastName: undefined };
    const placeholderEmail = phone
        ? `${phone.replace(/\D/g, "") || Date.now()}@phone.placeholder`
        : `unknown-${Date.now()}@phone.placeholder`;
    if (!lead) {
        const createData = {
            organizationId,
            email: email || placeholderEmail,
            status: "CONTACTED",
            source: "phone",
            lastContactedAt: new Date(),
            lastCallAt: new Date(),
        };
        if (phone)
            createData.phone = phone;
        if (fullName) {
            createData.fullName = fullName;
            if (firstName)
                createData.firstName = firstName;
            if (lastName)
                createData.lastName = lastName;
        }
        lead = await prisma.lead.create({ data: createData });
        return lead;
    }
    const updateData = {};
    if (phone && !lead.phone)
        updateData.phone = phone;
    if (email && !lead.email)
        updateData.email = email;
    if (fullName && !lead.fullName)
        updateData.fullName = fullName;
    if (firstName && !lead.firstName)
        updateData.firstName = firstName;
    if (lastName && !lead.lastName)
        updateData.lastName = lastName;
    if (lead.status === "NEW")
        updateData.status = "CONTACTED";
    updateData.lastContactedAt = new Date();
    updateData.lastCallAt = new Date();
    updateData.totalCalls = { increment: 1 };
    if (Object.keys(updateData).length > 0) {
        lead = await prisma.lead.update({
            where: { id: lead.id },
            data: updateData,
        });
    }
    return lead;
}
async function updateLeadForSession(session) {
    if (!session.organizationId || !session.leadId)
        return;
    const lead = await prisma.lead.findUnique({ where: { id: session.leadId } });
    if (!lead)
        return;
    const fullName = session.appointmentData?.patientName || session.contactName;
    const { firstName, lastName } = fullName
        ? splitFullName(fullName)
        : { firstName: undefined, lastName: undefined };
    const updateData = {};
    if (session.contactEmail && !lead.email)
        updateData.email = session.contactEmail;
    if (session.callerNumber && !lead.phone)
        updateData.phone = session.callerNumber.trim();
    if (fullName && !lead.fullName)
        updateData.fullName = fullName;
    if (firstName && !lead.firstName)
        updateData.firstName = firstName;
    if (lastName && !lead.lastName)
        updateData.lastName = lastName;
    if (lead.status === "NEW")
        updateData.status = "CONTACTED";
    updateData.lastContactedAt = new Date();
    updateData.lastCallAt = new Date();
    updateData.totalCalls = { increment: 1 };
    if (Object.keys(updateData).length > 0) {
        await prisma.lead.update({ where: { id: lead.id }, data: updateData });
    }
}
async function enqueueSpeech(session, transcriptOld) {
    if (!transcriptOld?.trim())
        return;
    console.log("[QUEUE ENTRY]", {
        transcriptOld,
        processing: session.isProcessingSpeech,
        queueLength: session.speechQueue?.length
    });
    session.speechQueue ??= [];
    const last = session.speechQueue[session.speechQueue.length - 1];
    if (last === transcriptOld) {
        console.log("[QUEUE] Duplicate skipped");
        return;
    }
    // session.speechQueue.push(transcriptOld);
    if (session.bargeInDetected) {
        session.speechQueue = [transcriptOld];
    }
    else {
        session.speechQueue.push(transcriptOld);
    }
    if (session.isProcessingSpeech) {
        return;
    }
    session.isProcessingSpeech = true;
    console.log("[QUEUE] Starting processing");
    try {
        while (session.speechQueue.length > 0) {
            const nextTranscript = session.speechQueue.shift();
            if (!nextTranscript)
                continue;
            try {
                console.log("[QUEUE] Processing:", nextTranscript);
                await processUserSpeech(session, nextTranscript);
            }
            catch (err) {
                console.error("[QUEUE ERROR]", err);
            }
        }
    }
    finally {
        session.isProcessingSpeech = false;
    }
}
async function safeSpeak(session, responseId, text) {
    if (!session?.tts)
        return;
    if (session.isEnding)
        return;
    if (responseId !== session.responseId) {
        console.log("[SAFE SPEAK] Cancelled before speaking");
        return;
    }
    try {
        await session.tts.speak(text, () => !!session?.isEnding || responseId !== session.responseId || !!session?.bargeInDetected || !!session?.cancelCurrentResponse || !!session?.interruptRequested);
        if (responseId !== session.responseId ||
            session.bargeInDetected ||
            session.isEnding ||
            session.cancelCurrentResponse ||
            session.interruptRequested) {
            return;
        }
        if (session.conversationId && session.lastUserTranscript) {
            await saveConversationMessages(session, session.lastUserTranscript, text);
            session.lastUserTranscript = undefined;
        }
    }
    catch (err) {
        console.error("[SAFE SPEAK ERROR]", err);
    }
}
async function saveConversationMessages(session, transcript, answer) {
    if (!session.conversationId)
        return;
    try {
        await prisma.message.create({
            data: {
                conversationId: session.conversationId,
                role: "user",
                content: transcript,
            },
        });
        await prisma.message.create({
            data: {
                conversationId: session.conversationId,
                role: "assistant",
                content: answer,
            },
        });
        await prisma.conversation.update({
            where: {
                id: session.conversationId,
            },
            data: {
                messageCount: {
                    increment: 2,
                },
                lastMessageAt: new Date(),
            },
        });
        console.log("[MESSAGE SAVED]", session.conversationId);
    }
    catch (error) {
        console.error("[MESSAGE SAVE ERROR]", error);
    }
}
async function processUserSpeech(session, userText) {
    console.log("[PROCESS ENTRY]", {
        userText,
        step: session.step,
        language: session.language,
        processing: session.isProcessingSpeech
    });
    if (session.isEnding)
        return;
    const transcript = userText.trim();
    // Skip noise / filler
    if (isNoiseUtterance(transcript)) {
        return;
    }
    // Feature flag: use new Agent architecture
    if (process.env.AGENT_MODE === "true") {
        const agentService = getAgentService();
        await agentService.process(transcript, session, {
            speak: (text) => safeSpeak(session, session.responseId || 0, text),
            endCall: (delayMs) => {
                setTimeout(() => {
                    try {
                        session.ws?.close();
                    }
                    catch (e) { }
                }, delayMs || 1000);
            },
        });
        return;
    }
    // Old architecture below (kept for backward compatibility)
    if (!userText?.trim() || !session.brain) {
        return;
    }
    const transcriptOld = userText.trim();
    // Skip noise / filler before any processing
    if (isNoiseUtterance(transcriptOld)) {
        return;
    }
    session.lastUserTranscript = transcriptOld;
    const currentResponseId = session.responseId || 0;
    const input = transcriptOld.toLowerCase();
    // Capture department early from any utterance (conversation memory)
    session.appointmentData ??= {};
    const lowerEarly = transcriptOld.toLowerCase();
    if (lowerEarly.includes("neuro"))
        session.appointmentData.department = "Neurology";
    else if (lowerEarly.includes("cardio"))
        session.appointmentData.department = "Cardiology";
    else if (lowerEarly.includes("ortho"))
        session.appointmentData.department = "Orthopedics";
    else if (lowerEarly.includes("derma"))
        session.appointmentData.department = "Dermatology";
    else if (lowerEarly.includes("pediatric") || lowerEarly.includes("paediatric"))
        session.appointmentData.department = "Pediatrics";
    else if (lowerEarly.includes("gyneco"))
        session.appointmentData.department = "Gynecology";
    // Prevent processing after transfer starts
    if (session.step === "transfer_pending") {
        console.log("[TRANSFER] Ignoring speech during transfer");
        return;
    }
    // GLOBAL RECEPTION TRANSFER
    const RECEPTION_KEYWORDS = [
        "front desk",
        "reception",
        "receptionist",
        "connect receptionist",
        "transfer call",
        "connect reception",
        "रिसेप्शन",
        "फ्रंट डेस्क",
        "रिसेप्शन से जोड़ो",
        "रिसेप्शन जोड़िए",
        "ರಿಸೆಪ್ಷನ್",
        "ಮುಂಭಾಗದ ಕಚೇರಿ",
        "ರಿಸೆಪ್ಷನ್ ಸಂಪರ್ಕಿಸಿ",
        "ರಿಸೆಪ್ಷನ್‌ಗೆ ಕನೆಕ್ಟ್ ಮಾಡಿ",
    ];
    if (RECEPTION_KEYWORDS.some((keyword) => input.includes(keyword))) {
        session.intent = "receptionist";
        await prisma.transferIntent.upsert({
            where: {
                callSid: session.callSid,
            },
            update: {
                intent: "receptionist",
            },
            create: {
                callSid: session.callSid,
                intent: "receptionist",
            },
        });
        console.log("[TRANSFER DETECTED]", session.callSid, "receptionist");
        session.step = "transfer_pending";
        const receptionistTransferPrompt = session.language === "hi-IN"
            ? "कृपया प्रतीक्षा करें, मैं आपको रिसेप्शन से जोड़ रहा हूँ।"
            : session.language === "kn-IN"
                ? "ದಯವಿಟ್ಟು ಕಾಯಿರಿ, ನಾನು ನಿಮ್ಮನ್ನು ರಿಸೆಪ್ಷನ್‌ಗೆ ಸಂಪರ್ಕಿಸುತ್ತಿದ್ದೇನೆ."
                : "Please hold while I connect you to our receptionist.";
        await safeSpeak(session, currentResponseId, receptionistTransferPrompt);
        await waitForExotelFlush(session);
        console.log("[TRANSFER] Closing voicebot for receptionist transfer");
        try {
            setTimeout(() => {
                try {
                    session.ws?.close();
                }
                catch { }
            }, 1000);
        }
        catch { }
        return;
    }
    // GLOBAL EMERGENCY TRANSFER
    const emergencyText = `${session.fullTranscript} ${transcriptOld}`.toLowerCase();
    if (isEmergency(emergencyText)) {
        session.intent = "emergency";
        await prisma.transferIntent.upsert({
            where: {
                callSid: session.callSid,
            },
            update: {
                intent: "emergency",
            },
            create: {
                callSid: session.callSid,
                intent: "emergency",
            },
        });
        console.log("[TRANSFER DETECTED]", session.callSid, "emergency");
        session.step = "transfer_pending";
        const emergencyTransferPrompt = session.language === "hi-IN"
            ? "कृपया लाइन पर बने रहें, मैं आपको आपातकालीन टीम से जोड़ रहा हूँ।"
            : session.language === "kn-IN"
                ? "ದಯವಿಟ್ಟು ಲೈನ್‌ನಲ್ಲಿ ಇರಿ, ನಾನು ನಿಮ್ಮನ್ನು ತುರ್ತು ವೈದ್ಯಕೀಯ ತಂಡಕ್ಕೆ ಸಂಪರ್ಕಿಸುತ್ತಿದ್ದೇನೆ."
                : "Please stay on the line while I connect you to our emergency team.";
        await safeSpeak(session, currentResponseId, emergencyTransferPrompt);
        await waitForExotelFlush(session);
        console.log("[TRANSFER] Closing voicebot for emergency transfer");
        try {
            setTimeout(() => {
                try {
                    session.ws?.close();
                }
                catch { }
            }, 1000);
        }
        catch { }
        return;
    }
    // =============================
    // APPOINTMENT RECALL (unchanged — "what's my appointment" after booking)
    // =============================
    const appointmentQuery = /(my appointment|appointment status|confirmed appointment|appointment details)/i.test(transcriptOld);
    if (appointmentQuery && session.appointmentConfirmed) {
        const appt = session.lastAppointment;
        await safeSpeak(session, currentResponseId, getFlowText("appointmentRecall", session.language)
            .replace("{department}", appt?.department || "")
            .replace("{date}", new Date(appt?.scheduledAt || "").toLocaleString("en-IN")));
        return;
    }
    // =============================
    // LANGUAGE SELECTION GATE (infra: switches STT/TTS provider locale — kept
    // as a one-shot gate rather than a planner tool call, see migration plan §5)
    // =============================
    if (session.step === "language_selection") {
        const langText = transcriptOld.toLowerCase();
        let selectedLang = SupportedLanguage.EN;
        const normalizedLang = langText
            .replace(/[^\p{L}\p{N}\s]/gu, "")
            .replace(/\s+/g, "")
            .trim()
            .toLowerCase();
        if (normalizedLang.includes("hindi") ||
            normalizedLang.includes("hindii") ||
            normalizedLang.includes("indi") ||
            normalizedLang.includes("indeed") ||
            normalizedLang.includes("hind") ||
            normalizedLang.includes("हिंदी")) {
            selectedLang = SupportedLanguage.HI;
        }
        else if (normalizedLang.includes("kannada") ||
            normalizedLang.includes("canada") ||
            normalizedLang.includes("caneda") ||
            normalizedLang.includes("kanada") ||
            normalizedLang.includes("ಕನ್ನಡ")) {
            selectedLang = SupportedLanguage.KN;
        }
        else if (normalizedLang.includes("english") ||
            normalizedLang.includes("inglish") ||
            normalizedLang.includes("english")) {
            selectedLang = SupportedLanguage.EN;
            // console.log("[Language Selected]", selectedLang);
        }
        else {
            const retryLanguagePrompt = {
                "en-IN": "Please say English, Hindi or Kannada.",
                "hi-IN": "कृपया English, Hindi या Kannada कहें।",
                "kn-IN": "ದಯವಿಟ್ಟು English, Hindi ಅಥವಾ Kannada ಎಂದು ಹೇಳಿ.",
            };
            const answer = retryLanguagePrompt[session.language] ?? retryLanguagePrompt["en-IN"];
            await safeSpeak(session, currentResponseId, answer);
            // await saveConversationMessages(session, transcriptOld, answer);
            return;
        }
        console.log("[Language Selected]", selectedLang);
        session.language = selectedLang;
        try {
            session.tts?.close();
            session.tts = new SarvamLiveTTS(getSarvamVoiceId(selectedLang), (chunk) => {
                sendAudioToProvider(session, chunk);
            }, undefined, (error) => {
                console.error("[TTS] Error:", error);
            }, session.provider === "exotel" ? "pcm16le8k" : "mulaw8k");
            // if (session.brain) {
            //   if (session.isAgentSpeaking) {
            //     return;
            //   }
            //   session.brain.changeLanguage(selectedLang);
            // }
            if (session.brain) {
                console.log("[Language] Updating Brain:", selectedLang);
                session.brain.changeLanguage(selectedLang);
            }
            // if (session.stt) {
            //   await session.stt.changeLanguage(selectedLang);
            // }
            if (session.stt) {
                console.log("[Language] Restarting STT...");
                session.stt
                    .changeLanguage(selectedLang)
                    .then(() => {
                    console.log("[Language] STT restarted");
                })
                    .catch((err) => {
                    console.error("[Language] STT restart failed", err);
                });
            }
            session.languageLocked = true;
            console.log("[Language] Locked:", session.language);
            session.step = "main_menu";
            // if (session.isAgentSpeaking) {
            //   return;
            // }
            const languageMenu = {
                "en-IN": "Would you like to book an appointment or speak with our front desk, or connect to an emergency doctor?",
                "hi-IN": "क्या आप अपॉइंटमेंट बुक करना चाहते हैं, फ्रंट डेस्क से बात करना चाहते हैं, या इमरजेंसी डॉक्टर से जुड़ना चाहते हैं?",
                "kn-IN": "ನೀವು ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಬುಕ್ ಮಾಡಲು, ನಮ್ಮ ಫ್ರಂಟ್ ಡೆಸ್ಕ್ ಜೊತೆ ಮಾತನಾಡಲು ಅಥವಾ ತುರ್ತು ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಲು ಬಯಸುವಿರಾ?",
            };
            session.step = "main_menu";
            const answer = languageMenu[selectedLang] ?? languageMenu["en-IN"];
            await safeSpeak(session, currentResponseId, answer);
            // await saveConversationMessages(session, transcriptOld, answer);
            session.lastInteractionAt = Date.now();
            session.silenceWarningSent = false;
        }
        catch (err) {
            console.error("[Language Selection Error]", err);
        }
        // session.isProcessingSpeech = false;
        return;
    }
    // =============================
    // AGENT TURN — replaces the old switch(session.step) appointment flow.
    // Planner (Groq function-calling) decides intent, missing slots, and
    // whether to call a tool (book/reschedule/cancel appointment, doctor
    // lookup, transfer, FAQ/RAG) or answer directly. See src/ai/conversation/agent-turn.ts.
    // =============================
    {
        const agentResult = await handleAgentTurn(session, transcriptOld, {
            speak: (text) => safeSpeak(session, currentResponseId, text),
            endCall: (delayMs) => {
                setTimeout(() => {
                    try {
                        session.ws?.close();
                    }
                    catch { }
                }, delayMs ?? 1000);
            },
        });
        if (agentResult.handled) {
            session.lastInteractionAt = Date.now();
            session.silenceWarningSent = false;
            return;
        }
    }
    // =============================
    // CONTACT INFORMATION EXTRACTION
    // =============================
    if (!session.contactEmail) {
        const email = extractEmail(transcriptOld);
        if (email) {
            session.contactEmail = email;
            console.log("📧 Detected email:", email);
        }
    }
    if (!session.contactName) {
        const contactName = extractContactName(transcriptOld);
        if (contactName) {
            session.contactName = contactName;
            console.log("👤 Detected contact name:", contactName);
        }
    }
    // =============================
    // APPOINTMENT ENTITY EXTRACTION
    // =============================
    const lower = transcriptOld.toLowerCase();
    session.appointmentData ??= {};
    // =========================
    // DYNAMIC DATE/TIME PARSER
    // =========================
    const parsedDate = chrono.parseDate(transcriptOld);
    if (parsedDate) {
        session.appointmentData.scheduledAt = parsedDate;
        console.log("📅 Parsed Appointment Date:", parsedDate);
    }
    // =========================
    // PATIENT NAME EXTRACTION
    // =========================
    const nameMatch = transcriptOld.match(/my name is (.+)|i am (.+)|this is (.+)/i);
    if (nameMatch) {
        const extractedName = nameMatch[1] || nameMatch[2] || nameMatch[3];
        if (extractedName) {
            session.appointmentData.patientName = extractedName.trim();
            console.log("👤 Patient Name:", extractedName);
        }
    }
    // Department — capture early so we don't re-ask
    if (lower.includes("neuro"))
        session.appointmentData.department = "Neurology";
    else if (lower.includes("cardio"))
        session.appointmentData.department = "Cardiology";
    else if (lower.includes("ortho"))
        session.appointmentData.department = "Orthopedics";
    else if (lower.includes("derma"))
        session.appointmentData.department = "Dermatology";
    else if (lower.includes("pediatric") || lower.includes("paediatric"))
        session.appointmentData.department = "Pediatrics";
    else if (lower.includes("gyneco"))
        session.appointmentData.department = "Gynecology";
    // Update session intent
    const currentIntent = detectIntent(transcriptOld);
    if (currentIntent !== "general") {
        session.intent = currentIntent;
        console.log(`[Intent] Detected: ${currentIntent}`);
    }
    console.log(`[Speech] User: "${transcriptOld.substring(0, 100)}..."`);
    const lowerTranscript = transcriptOld.toLowerCase();
    if (session.appointmentConfirmed &&
        /(already booked|my appointment|appointment details|do you remember)/i.test(transcriptOld)) {
        const appt = session.lastAppointment;
        await safeSpeak(session, currentResponseId, getFlowText("appointmentRecall", session.language)
            .replace("{department}", appt?.department || "")
            .replace("{date}", new Date(appt?.scheduledAt || "").toLocaleString("en-IN")));
        return;
    }
    const END_CALL_KEYWORDS = [
        // English
        "thank you",
        "thanks",
        "bye",
        "goodbye",
        // Hindi
        "धन्यवाद",
        "शुक्रिया",
        "अलविदा",
        "बाय",
        // Kannada
        "ಧನ್ಯವಾದ",
        "ಧನ್ಯವಾದಗಳು",
        "ವಿದಾಯ",
        "ಬೈ",
    ];
    if (END_CALL_KEYWORDS.some((keyword) => lowerTranscript.includes(keyword.toLowerCase()))) {
        session.isAgentSpeaking = true;
        session.isUserSpeaking = false;
        session.bargeInDetected = false;
        try {
            if (!session.isEnding && session.tts) {
                const currentResponseId = session.responseId || 0;
                const goodbyePrompt = {
                    "en-IN": "Thank you for calling. Have a great day!",
                    "hi-IN": "कॉल करने के लिए धन्यवाद। आपका दिन शुभ हो।",
                    "kn-IN": "ಕರೆ ಮಾಡಿದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ದಿನ ಶುಭವಾಗಿರಲಿ.",
                };
                await safeSpeak(session, currentResponseId, goodbyePrompt[session.language] ?? goodbyePrompt["en-IN"]);
                await waitForExotelFlush(session);
                sendMarkToProvider(session, "response-complete");
            }
        }
        catch (closeError) {
            console.error("[Call End] Farewell TTS failed:", closeError);
        }
        finally {
            const queued = session.bargeInTranscript;
            session.bargeInTranscript = null;
            if (queued && !session.isEnding) {
                enqueueSpeech(session, queued).catch(console.error);
            }
            // session.isProcessingSpeech = false;
            session.isAgentSpeaking = false;
            session.bargeInDetected = false;
        }
        setTimeout(() => {
            try {
                session.ws.close();
            }
            catch (_) { }
        }, 2000);
        return;
    }
    // ── Language Detection: lock once on first strong signal, never switch after ─
    if (!session.languageLocked && session.step !== "language_selection") {
        const detectionResult = detectLanguage({
            text: transcriptOld,
            storedLanguage: session.language,
            defaultLanguage: SupportedLanguage.EN,
        });
        if (detectionResult.isStrong) {
            const requiredCount = detectionResult.detectionMethod === "unicode" ? 1 : 2;
            if (detectionResult.language === session.lastDetectedLanguage) {
                session.detectionCount++;
            }
            else {
                session.detectionCount = 1;
                session.lastDetectedLanguage = detectionResult.language;
            }
            if (session.detectionCount >= requiredCount) {
                await lockDetectedLanguage(session, detectionResult.language);
            }
        }
    }
    // ─────────────────────────────────────────────────────────────────────────────
    session.lastInteractionAt = Date.now();
    session.silenceWarningSent = false;
    // Add to transcriptOld
    session.fullTranscript += `\nUser: ${transcriptOld}`;
    session.isUserSpeaking = true;
    // if (session.isAgentSpeaking) {
    //   clearProviderAudio(session);
    //   setTimeout(() => {
    //     session.isAgentSpeaking = false;
    //   }, 500);
    //   console.log("[BARGE-IN] User interrupted AI speech");
    // }
    // Prevent processing while agent is speaking (unless barge-in)
    if (session.isAgentSpeaking && !session.bargeInDetected) {
        console.log("[Speech] Agent still speaking, will retry in 600ms");
        //session.isProcessingSpeech = false; // release mutex
        // Retry after TTS finishes instead of silently dropping
        setTimeout(() => {
            if (!session.isEnding && !session.isProcessingSpeech) {
                enqueueSpeech(session, userText).catch(console.error);
            }
        }, 600);
        return;
    }
    //session.isAgentSpeaking = true;
    session.isUserSpeaking = false;
    //session.bargeInDetected = false;
    console.log(`[Speech] User: "${transcriptOld}"`);
    const startTime = Date.now();
    try {
        // === DUAL-BRAIN: Filler + Real Response (Parallel) ===
        console.log(`[LLM] Triggering Brain for: "${transcriptOld.substring(0, 50)}..."`);
        // Pass collected slots so LLM does not re-ask
        session.brain.setConversationContext({
            patientName: session.appointmentData?.patientName || session.contactName,
            department: session.appointmentData?.department,
            appointmentDate: session.appointmentData?.scheduledAt?.toLocaleString("en-IN"),
            phone: session.callerNumber,
            email: session.contactEmail,
        });
        // Start real response generation
        const responsePromise = session.brain.generateResponse(transcriptOld);
        // Speak filler immediately with even tighter timeout
        // try {
        //   const fillerPromise = session.brain.generateFiller(transcriptOld);
        //   const fillerTimeout = new Promise<string>(
        //     (resolve) => setTimeout(() => resolve(""), 1200), // ⚡ Reduced from 500ms
        //   );
        //   const filler = await Promise.race([fillerPromise, fillerTimeout]);
        //   if (
        //     filler &&
        //     filler.trim().length > 0 &&
        //     session.tts &&
        //     !session.bargeInDetected &&
        //     !session.isEnding
        //   ) {
        //     console.log(
        //       `[TTS] Filler: "${filler}" (after ${Date.now() - startTime}ms)`,
        //     );
        //     session.isAgentSpeaking = true;
        //     await session.tts.speak(filler, () => !!session?.isEnding);
        //     await waitForExotelFlush(session);
        //   }
        // } catch (fillerError) {
        //   console.error("[Filler] Error:", fillerError);
        // }
        //fillers disabled for natural hospital conversation flow and to reduce TTS calls which can cause more barge-in opportunities and complexity. Can be re-enabled with confidence thresholds in the future.
        // 🔥 SILENCE PADDING: Prevent Exotel timeout while waiting for LLM
        session.llmPaddingTimer = setInterval(() => {
            if (session.bargeInDetected || session.isEnding || !session.isAgentSpeaking) {
                if (session.llmPaddingTimer) {
                    clearInterval(session.llmPaddingTimer);
                    session.llmPaddingTimer = undefined;
                }
                return;
            }
            // Send 100ms of silence
            const SILENCE_CHUNK = session.provider === "exotel" ? Buffer.alloc(3200) : Buffer.alloc(320);
            sendAudioToProvider(session, SILENCE_CHUNK);
        }, 100);
        let dualBrainResponse;
        try {
            // Now wait for real response
            dualBrainResponse = await responsePromise;
        }
        finally {
            // ALWAYS clear silence interval — happy path AND error path
            if (session.llmPaddingTimer) {
                clearInterval(session.llmPaddingTimer);
                session.llmPaddingTimer = undefined;
            }
        }
        const { answer, requiresTransfer } = dualBrainResponse;
        console.log(`[LLM] Answer received (${Date.now() - startTime}ms): "${answer.substring(0, 50)}..."`);
        if (session.bargeInDetected) {
            console.log("[BARGE-IN] Cancelling previous response");
            session.isAgentSpeaking = false;
            //session.isProcessingSpeech = false;
            return;
        }
        // if (session.isAgentSpeaking) {
        //   return;
        // }
        // Speak the real answer (sentence by sentence for better streaming)
        if (answer && session.tts) {
            if (!session.bargeInDetected && !session.isEnding) {
                console.log(`[TTS] Full Response: "${answer.substring(0, 100)}..."`);
                session.isAgentSpeaking = true;
                if (currentResponseId !== session.responseId) {
                    console.log("[CANCELLED] Old response discarded");
                    return;
                }
                // RESET INTERRUPT FLAGS FOR THE NEW RESPONSE
                // session.cancelCurrentResponse = false;
                // session.interruptRequested = false;
                await safeSpeak(session, currentResponseId, answer);
                console.log("[TTS] Response streaming completed");
                if (currentResponseId === session.responseId) {
                    session.cancelCurrentResponse = false;
                    session.interruptRequested = false;
                }
                if (session) {
                    session.lastInteractionAt = Date.now();
                    session.silenceWarningSent = false;
                }
                await waitForExotelFlush(session);
                sendMarkToProvider(session, "response-complete");
            }
        }
        session.fullTranscript += `\nAssistant: ${answer}`;
        // ====================================
        // CREATE REAL APPOINTMENT IN DATABASE
        // ====================================
        try {
            const appt = session.appointmentData;
            const bookingIntent = session.step === "completed" && !!appt?.scheduledAt;
            if (bookingIntent && appt?.department && appt?.scheduledAt && !appt.dbSaved) {
                appt.dbSaved = true;
                console.log("📅 Creating appointment:", appt);
                // =========================
                // CREATE / FIND PATIENT
                // =========================
                console.log("📅 Creating appointment:", appt);
                // =========================
                // CREATE PATIENT
                // =========================
                if (!session.organizationId) {
                    console.error("[Appointment] Missing organizationId. Cannot save appointment.");
                    // session.isProcessingSpeech = false;
                    return;
                }
                const patient = await prisma.patient.create({
                    data: {
                        organizationId: session.organizationId || process.env.DEFAULT_ORGANIZATION_ID,
                        fullName: appt.patientName || "Voice Caller",
                        phone: session.callerNumber || "Unknown",
                    },
                });
                // =========================
                // FIND / CREATE DEPARTMENT
                // =========================
                const department = await prisma.department.upsert({
                    where: {
                        organizationId_name: {
                            organizationId: session.organizationId || process.env.DEFAULT_ORGANIZATION_ID,
                            name: appt.department,
                        },
                    },
                    update: {},
                    create: {
                        organizationId: session.organizationId || process.env.DEFAULT_ORGANIZATION_ID,
                        name: appt.department,
                    },
                });
                // =========================
                // CREATE APPOINTMENT
                // =========================
                const appointment = await prisma.appointment.create({
                    data: {
                        organizationId: session.organizationId || process.env.DEFAULT_ORGANIZATION_ID,
                        patientId: patient.id,
                        departmentId: department.id,
                        scheduledAt: appt.scheduledAt,
                        appointmentType: "OPD",
                        status: "SCHEDULED",
                        bookedVia: "VOICE_AI",
                        notes: session.fullTranscript,
                    },
                });
                console.log("✅ Appointment saved:", appointment.id);
                // Link appointment and patient to the active conversation
                if (session.conversationId) {
                    await prisma.conversation
                        .update({
                        where: { id: session.conversationId },
                        data: {
                            appointmentBooked: true,
                            patientId: patient.id,
                        },
                    })
                        .catch((error) => {
                        console.error("[Conversation] Failed to link appointment to conversation", error);
                    });
                }
                if (session.leadId) {
                    await prisma.lead
                        .update({
                        where: { id: session.leadId },
                        data: {
                            status: "MEETING_SET",
                            lastContactedAt: new Date(),
                            lastCallAt: new Date(),
                        },
                    })
                        .catch(() => { });
                }
                const appointmentTime = appointment.scheduledAt.toLocaleString("en-IN", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                });
                const patientName = patient.fullName || "there";
                const appointmentText = `Hi ${patientName}, your appointment is confirmed for ${appointmentTime} in ${department.name}. Please arrive at the hospital 15 minutes before your scheduled appointment time.`;
                try {
                    if (patient.phone) {
                        const smsResult = await sendSMSMessage(patient.phone, appointmentText);
                        console.log("[SMS] Appointment confirmation result:", smsResult);
                    }
                }
                catch (smsError) {
                    console.error("[SMS] Appointment confirmation failed:", smsError);
                }
                if (session.contactEmail) {
                    try {
                        await sendEmail({
                            to: session.contactEmail,
                            toName: patient.fullName || patient.firstName || "there",
                            subject: "Your appointment is confirmed",
                            html: `<p>Hi ${patient.fullName || patient.firstName || "there"},</p><p>Your appointment has been confirmed for <strong>${appointmentTime}</strong> in <strong>${department.name}</strong>.</p><p>Please arrive at the hospital 15 minutes before your scheduled appointment time.</p><p>Thank you!</p>`,
                            text: appointmentText,
                        });
                        console.log("[Email] Appointment confirmation email sent to", session.contactEmail);
                    }
                    catch (emailError) {
                        console.error("[Email] Appointment confirmation failed:", emailError);
                    }
                }
            }
        }
        catch (dbError) {
            console.error("❌ Appointment DB Error:", dbError);
        }
        // Handle special cases
        if (isEmergency(transcriptOld)) {
            console.log("[Emergency] Detected - informing user");
            session.fullTranscript += "\n[EMERGENCY DETECTED]";
        }
        if (requiresTransfer) {
            console.log("[Transfer] Required - flagging for supervisor");
            session.fullTranscript += "\n[TRANSFER REQUESTED]";
        }
        //   console.log("[MESSAGE DEBUG]", {
        //     conversationId: session.conversationId,
        //     transcriptOld,
        //     answer,
        //   });
        //   console.log("🔥 MESSAGE BLOCK REACHED");
        //   // Save to database asynchronously (fire-and-forget)
        //   if (session.conversationId) {
        //     (async () => {
        //       try {
        //         console.log("[MESSAGE SAVE START]");
        //         await Promise.all([
        //           prisma.message.create({
        //             data: {
        //               conversationId: session.conversationId!,
        //               role: "user",
        //               content: transcript,
        //             },
        //           }),
        //           prisma.message.create({
        //             data: {
        //               conversationId: session.conversationId!,
        //               role: "assistant",
        //               content: answer,
        //             },
        //           }),
        //         ]);
        //         console.log("[MESSAGE SAVE SUCCESS]");
        //       } catch (dbError) {
        //         console.error("[DB] Error saving messages:", dbError);
        //       }
        //     })();
        //   }
        // } catch (error: any) {
        //   console.error("[Process Speech] Error:", error);
        // Recovery: apologize and continue
        if (session.tts) {
            try {
                const currentResponseId = session.responseId || 0;
                const ERROR_RECOVERY_PROMPTS = {
                    "en-IN": "I apologize, could you please repeat that?",
                    "hi-IN": "क्षमा करें, क्या आप कृपया दोबारा बता सकते हैं?",
                    "kn-IN": "ಕ್ಷಮಿಸಿ, ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಹೇಳಬಹುದೇ?",
                };
                await safeSpeak(session, currentResponseId, ERROR_RECOVERY_PROMPTS[session.language] ?? ERROR_RECOVERY_PROMPTS["en-IN"]);
                await waitForExotelFlush(session);
                // await waitForFlush();
                sendMarkToProvider(session, "response-complete");
            }
            catch (e) {
                console.error("[Recovery TTS] Error:", e);
            }
        }
    }
    finally {
        //session.isProcessingSpeech = false;
        session.isAgentSpeaking = false;
        if (!session.interruptRequested) {
            //session.isAgentSpeaking = false;
            session.bargeInDetected = false;
        }
    }
    // Flush buffered caller audio after TTS completes
    if (session.audioQueue.length > 0 && session.stt && session.sttReady) {
        console.log(`[AudioQueue] Flushing ${session.audioQueue.length} queued chunks`);
        while (session.audioQueue.length > 0) {
            const queuedChunk = session.audioQueue.shift();
            if (!queuedChunk)
                continue;
            session.exotelInBuffer = Buffer.concat([
                session.exotelInBuffer || Buffer.alloc(0),
                queuedChunk,
            ]);
            const flushChunk = session.provider === "exotel" ? 640 : 320;
            while (session.exotelInBuffer.length >= flushChunk) {
                const chunk = session.exotelInBuffer.subarray(0, flushChunk);
                session.exotelInBuffer = session.exotelInBuffer.subarray(flushChunk);
                await session.stt.sendAudio(chunk);
            }
        }
    }
}
/**
 * Handle end of call
 */
async function endCall(session) {
    if (session.isEnding)
        return;
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
    // Stop STT
    if (session.stt) {
        try {
            await session.stt.stop();
        }
        catch (e) {
            console.error("[STT Stop] Error:", e);
        }
    }
    // Close TTS
    if (session.tts) {
        try {
            session.tts.close();
        }
        catch (e) {
            console.error("[TTS Close] Error:", e);
        }
    }
    // Flush remaining Exotel outbound buffer at call end
    if (session.provider === "exotel" &&
        session.exotelOutBuffer &&
        session.exotelOutBuffer.length > 0) {
        const minSize = 3200;
        const multiple = 320;
        let out = session.exotelOutBuffer;
        if (out.length < minSize) {
            out = Buffer.concat([out, Buffer.alloc(minSize - out.length)]);
        }
        else if (out.length % multiple !== 0) {
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
                session.ws.send(JSON.stringify({
                    event: "media",
                    stream_sid: session.sessionId,
                    media: {
                        payload: out.toString("base64"),
                    },
                }));
            }
        }
        catch (flushError) {
            console.error("[Exotel Flush] Error:", flushError);
        }
        session.exotelOutBuffer = Buffer.alloc(0);
    }
    // Save call analysis
    if (session.brain && session.conversationId) {
        try {
            const analysis = await session.brain.classifyCall(session.fullTranscript);
            await prisma.conversation.update({
                where: { id: session.conversationId },
                data: {
                    status: "CLOSED",
                    summary: analysis.summary,
                    sentiment: analysis.sentiment,
                    endedAt: new Date(),
                },
            });
            console.log("[Analysis] Call classified:", analysis.leadScore);
        }
        catch (error) {
            console.error("[Analysis] Error:", error);
        }
        try {
            await updateLeadForSession(session);
        }
        catch (leadError) {
            console.error("[Lead Sync] Error updating lead after call end:", leadError);
        }
    }
    // Clean up session
    SESSION_MAP.delete(session.sessionId);
    console.log(`[Session] Cleaned up: ${session.sessionId}`);
}
/**
 * Main WebSocket message handler
 */
export async function handleWebSocketMessage(ws, data) {
    try {
        // Log chunk size to file for analysis using absolute path relative to this file
        const logPath = path.resolve(__dirname, "../../../chunks.log");
        chunkLogStream.write(`[${new Date().toISOString()}] Chunk size: ${data.length}\n`);
        const rawMessage = typeof data === "string" ? data : data.toString();
        //console.log('[WS RAW]', rawMessage.slice(0, 500));
        const message = JSON.parse(rawMessage);
        const event = message.event;
        const resolvedStreamSid = message.streamSid ||
            message.stream_sid ||
            message.start?.streamSid ||
            message.start?.stream_sid;
        let session = resolvedStreamSid ? SESSION_MAP.get(resolvedStreamSid) : undefined;
        switch (event) {
            // ── Connection established ─────────────────────────────────────────
            case "connected":
                console.log("[WS] Connected event received");
                break;
            // ── Call started ───────────────────────────────────────────────────
            case "start": {
                const startPayload = message.start || {};
                const streamSid = startPayload.streamSid ||
                    startPayload.stream_sid ||
                    message.streamSid ||
                    message.stream_sid;
                const callSid = startPayload.callSid || startPayload.call_sid || "";
                const params = startPayload.customParameters || startPayload.custom_parameters || {};
                const provider = startPayload.stream_sid || message.stream_sid ? "exotel" : "twilio";
                let organizationId = params.organizationId ||
                    params.organization_id ||
                    process.env.DEFAULT_ORGANIZATION_ID ||
                    undefined;
                let agentId = params.agentId || params.agent_id || "";
                const language = params.language || params.lang || SupportedLanguage.EN;
                let direction = params.direction ||
                    params.callType || // 'outbound' passed from makeOutboundCall
                    (provider === "exotel" ? "INBOUND" : "INBOUND");
                direction = direction.toUpperCase();
                //const isOutboundCall = direction?.toUpperCase() === "OUTBOUND";
                let calledNumber = params.calledNumber || params.to || startPayload.to || "";
                let callerNumber = params.callerNumber || params.from || startPayload.from || "";
                let recoveredLeadId;
                if ((!organizationId || !agentId) && callSid) {
                    try {
                        const existingConversation = await prisma.conversation.findUnique({
                            where: { twilioCallSid: callSid },
                            select: {
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
                            direction = existingConversation.callDirection || direction;
                            callerNumber ||= existingConversation.phoneFrom || callerNumber;
                            calledNumber ||= existingConversation.phoneTo || calledNumber;
                            recoveredLeadId = existingConversation.leadId || undefined;
                            console.log("[WS START] Recovered conversation metadata from DB", {
                                callSid,
                                organizationId,
                                agentId,
                                direction,
                                leadId: recoveredLeadId,
                            });
                        }
                    }
                    catch (dbError) {
                        console.error("[WS START] Failed to recover conversation metadata:", dbError);
                    }
                }
                const mediaFormat = startPayload.media_format || {};
                const sampleRate = Number(mediaFormat.sample_rate || params.sampleRate || params.sample_rate || 8000);
                // Exotel bidirectional sends caller audio as linear16 (PCM16LE) at 8kHz.
                // media_format.encoding is just the transport ("base64"), not the audio codec.
                // Deepgram MUST be told linear16 for Exotel, otherwise it decodes as garbage.
                const dgEncoding = provider === "exotel" ? "linear16" : "mulaw";
                // ── Resolve final language ────────────────────────────────────────
                // For outbound calls, recover the selected language from DB if
                // customParameters did not carry it (Exotel CustomField may be absent
                // on first connection).
                let resolvedLanguage = language;
                const isOutbound = direction === "OUTBOUND";
                if (callSid && (!resolvedLanguage || resolvedLanguage === SupportedLanguage.EN)) {
                    try {
                        const conv = await prisma.conversation.findUnique({
                            where: { twilioCallSid: callSid },
                            select: { detectedLanguage: true, callDirection: true },
                        });
                        if (conv?.detectedLanguage && conv.detectedLanguage !== "en-IN") {
                            resolvedLanguage = conv.detectedLanguage;
                            console.log(`[WS START] Language recovered from DB: ${resolvedLanguage}`);
                        }
                    }
                    catch (err) {
                        console.warn("[WS START] DB language recovery failed:", err);
                    }
                }
                // 1. Initialize Session IMMEDIATELY (Synchronous)
                session = initializeSession(ws, {
                    streamSid,
                    callSid,
                    organizationId,
                    language: resolvedLanguage,
                    provider,
                });
                if (direction !== "OUTBOUND") {
                    // Inbound: ask caller to explicitly pick English/Hindi/Kannada first.
                    session.step = "language_selection";
                    session.languageLocked = false;
                }
                session.callerNumber = callerNumber;
                if (recoveredLeadId) {
                    session.leadId = recoveredLeadId;
                }
                // Fetch lead name for outbound greeting personalization
                let outboundLeadName = null;
                if (isOutbound && recoveredLeadId) {
                    try {
                        const leadRecord = await prisma.lead.findUnique({
                            where: { id: recoveredLeadId },
                            select: { fullName: true, firstName: true, lastName: true },
                        });
                        if (leadRecord) {
                            outboundLeadName =
                                leadRecord.fullName ||
                                    [leadRecord.firstName, leadRecord.lastName].filter(Boolean).join(" ") ||
                                    null;
                        }
                    }
                    catch (leadFetchErr) {
                        console.warn("[WS START] Could not fetch lead name for outbound greeting:", leadFetchErr);
                    }
                }
                // Always ask caller to explicitly pick a language (English/Hindi/Kannada).
                // Start the selection prompt in English, then lock after user selection.
                session.language = SupportedLanguage.EN;
                session.languageLocked = false;
                session.step = "language_selection";
                session.detectionCount = 0;
                session.lastDetectedLanguage = "";
                console.log("[WS START]", {
                    provider,
                    streamSid,
                    callSid,
                    organizationId,
                    agentId,
                    direction,
                    resolvedLanguage,
                    languageLocked: session.languageLocked,
                    dgEncoding,
                    sampleRate,
                });
                // Declare greeting vars BEFORE the STT constructor — the onReady async
                // callback closes over these, so they must exist before DeepgramLiveSTT is created
                const _hospName = process.env.HOSPITAL_NAME || "our hospital";
                const _agentId = process.env.AGENT_NAME || "MedAssist";
                const LANG_GREETINGS = {
                    "en-IN": `Welcome to ${_hospName}. Which language are you comfortable with? English, Hindi or Kannada?`,
                    "hi-IN": `नमस्ते! ${_hospName} में आपका स्वागत है। मैं आपकी कैसे मदद कर सकता हूँ?`,
                    "te-IN": `నమస్కారం! ${_hospName} లో నేను మీకు ఎలా సహాయం చేయగలను?`,
                    "ta-IN": `வணக்கம்! ${_hospName} இல் நான் எப்படி உதவலாம்?`,
                    "kn-IN": `ನಮಸ್ಕಾರ! ${_hospName} ನಲ್ಲಿ ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?`,
                    "mr-IN": `नमस्कार! ${_hospName} मध्ये आपले स्वागत आहे. तुम्ही म्हणू शकता: अपॉइंटमेंट बुक करा. इमर्जन्सी. किंवा फ्रंट डेस्कशी कनेक्ट व्हा. मी कशी मदत करू?`,
                    "ml-IN": `നമസ്കാരം! ${_hospName} ൽ ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കാം?`,
                    "bn-IN": `নমস্কার! ${_hospName}-এ আমি কীভাবে সাহায্য করতে পারি?`,
                    "gu-IN": `નમસ્તે! ${_hospName} માં હું કેવી રીતે મદદ કરી શકું?`,
                    "pa-IN": `ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ${_hospName} ਵਿੱਚ ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?`,
                    "or-IN": `ନମସ୍କାର! ମୁଁ ${_agentId}, ${_hospName} ର AI ସହାୟକ। ମୁଁ ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପാരി?`,
                };
                // Name-ask suffixes for inbound calls (one per language)
                const LANG_NAME_ASK = {
                    "en-IN": " May I know your name please?",
                    "hi-IN": " क्या मैं आपका नाम जान सकता हूं?",
                    "te-IN": " మీ పేరు చెప్పగలరా?",
                    "ta-IN": " உங்கள் பெயர் தெரியுமா?",
                    "kn-IN": " ನಿಮ್ಮ ಹೆಸರು ತಿಳಿಸಲು ಸಾಧ್ಯವೇ?",
                    "ml-IN": " നിങ്ങളുടെ പേര്‍ പറയാമോ?",
                    "mr-IN": " मी आपले नाव जाणून घेऊ का?",
                    "bn-IN": " আপনার নাম কি বলবেন?",
                    "gu-IN": " શું હું તમારું નામ જાણી શકું?",
                    "pa-IN": " ਕੀ ਮੈਂ ਤੁਹਾਡਾ ਨਾਮ ਜਾਣ ਸਕਦਾ ਹਾਂ?",
                    "or-IN": " ଆପଣଙ୍କ ନାମ ଜାଣିପାରିବି କି?",
                };
                const baseLang = resolvedLanguage || "en-IN";
                const baseGreeting = params.greeting || LANG_GREETINGS[baseLang] || LANG_GREETINGS["en-IN"];
                let greeting;
                if (isOutbound) {
                    // Outbound: greet lead by name if available, otherwise use base greeting unchanged
                    if (outboundLeadName) {
                        const nameGreetings = {
                            "en-IN": `Hello ${outboundLeadName}! `,
                            "hi-IN": `नमस्ते ${outboundLeadName}! `,
                            "te-IN": `నమస్కారం ${outboundLeadName}! `,
                            "ta-IN": `வணக்கம் ${outboundLeadName}! `,
                            "kn-IN": `ನಮಸ್ಕಾರ ${outboundLeadName}! `,
                            "ml-IN": `നമസ്കാരം ${outboundLeadName}! `,
                            "mr-IN": `नमस्कार ${outboundLeadName}! `,
                            "bn-IN": `নমস্কার ${outboundLeadName}! `,
                            "gu-IN": `નમસ્તે ${outboundLeadName}! `,
                            "pa-IN": `ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${outboundLeadName}! `,
                            "or-IN": `ନମସ୍କାର ${outboundLeadName}! `,
                        };
                        // Strip the first salutation word from baseGreeting to avoid doubling it
                        const withoutFirstWord = baseGreeting.replace(/^\S+\s*/, "");
                        greeting =
                            (nameGreetings[baseLang] || `Hello ${outboundLeadName}! `) + withoutFirstWord;
                    }
                    else {
                        greeting = baseGreeting;
                    }
                }
                else {
                    // Inbound: use base greeting then ask for the caller's name
                    greeting = LANG_GREETINGS["en-IN"];
                }
                // Force greeting to the explicit language-selection prompt.
                // (Both inbound and outbound should ask the user to pick English/Hindi/Kannada.)
                greeting = LANG_GREETINGS["en-IN"];
                try {
                    session.tts = new SarvamLiveTTS(getSarvamVoiceId(session.language), (chunk) => {
                        sendAudioToProvider(session, chunk);
                    }, undefined, (error) => {
                        console.error("[TTS] Error:", error);
                    }, session.provider === "exotel" ? "pcm16le8k" : "mulaw8k");
                }
                catch (error) {
                    console.error("[TTS] Failed to initialize, keeping websocket alive:", error?.message || error);
                    session.tts = null;
                }
                let greetingStarted = false;
                // 2. Initialize STT IMMEDIATELY
                let pendingTranscript = "";
                //let transcriptOldDebounce: NodeJS.Timeout | null = null;
                let lastProcessedTranscript = "";
                session.stt = new DeepgramLiveSTT(async (event) => {
                    const transcriptOld = event.transcript?.trim();
                    if (!transcriptOld || transcriptOld.length < 2) {
                        return;
                    }
                    // Filter noise / filler before any downstream processing
                    // if (event.isFinal && isNoiseUtterance(transcriptOld, event.confidence)) {
                    //   console.log(`[STT] Ignoring noise utterance: "${transcriptOld}"`);
                    //   return;
                    // }
                    const noise = isNoiseUtterance(transcriptOld, event.confidence);
                    console.log({
                        transcriptOld,
                        confidence: event.confidence,
                        noise
                    });
                    if (event.isFinal && noise) {
                        console.log("[NOISE FILTER]");
                        return;
                    }
                    console.log(`🧠 STT (${event.isFinal ? "FINAL" : "INTERIM"}): ${transcriptOld}`);
                    console.log("===== LINE A =====");
                    pendingTranscript = transcriptOld;
                    if (!event.isFinal &&
                        session?.isAgentSpeaking &&
                        !session?.bargeInDetected &&
                        transcriptOld.length > 2) {
                        console.log("[BARGE-IN] First interim detected");
                        await interruptCurrentResponse(session);
                        await enqueueSpeech(session, transcriptOld);
                        return;
                    }
                    const flushTranscript = () => {
                        console.log("[FLUSH ENTRY]", {
                            processing: session?.isProcessingSpeech,
                            speaking: session?.isAgentSpeaking,
                            step: session?.step,
                            pendingTranscript,
                            lastProcessedTranscript
                        });
                        if (!pendingTranscript)
                            return;
                        if (pendingTranscript === lastProcessedTranscript)
                            return;
                        // If agent is still speaking (not barge-in), wait for it to finish
                        // then re-trigger — don't silently drop the transcriptOld
                        if (session?.isAgentSpeaking && !session?.bargeInDetected) {
                            console.log("[STT] Agent speaking, queuing transcriptOld for after TTS...");
                            const queued = transcriptOld || pendingTranscript;
                            pendingTranscript = "";
                            let retries = 0;
                            const maxRetries = 40; // 40 × 200ms = 8s max wait
                            const waitForIdle = () => {
                                if (session?.isEnding)
                                    return;
                                if (session?.isAgentSpeaking && retries < maxRetries) {
                                    retries++;
                                    setTimeout(waitForIdle, 200);
                                    return;
                                }
                                if (!session?.isProcessingSpeech) {
                                    lastProcessedTranscript = queued;
                                    const activeSession = session;
                                    if (!activeSession)
                                        return;
                                    enqueueSpeech(activeSession, queued).catch((err) => {
                                        console.error("[enqueueSpeech] Queued Error:", err);
                                        activeSession.isAgentSpeaking = false;
                                        activeSession.bargeInDetected = false;
                                    });
                                }
                            };
                            setTimeout(waitForIdle, 200);
                            return;
                        }
                        console.log("🚀 TRIGGERING LLM:", pendingTranscript);
                        lastProcessedTranscript = pendingTranscript;
                        const activeSession = session;
                        if (!activeSession)
                            return;
                        console.log("[FLUSH] Calling enqueueSpeech:", pendingTranscript);
                        enqueueSpeech(activeSession, pendingTranscript).catch((err) => {
                            console.error("[enqueueSpeech] Unhandled Error:", err);
                            activeSession.isAgentSpeaking = false;
                            activeSession.bargeInDetected = false;
                        });
                        pendingTranscript = "";
                    };
                    // if (
                    //   session?.isAgentSpeaking &&
                    //   event.isFinal &&
                    //   transcriptOld &&
                    //   event.confidence &&
                    //   event.confidence > 0.85 &&
                    //   transcriptOld.trim().split(/\s+/).length >= 3
                    // ) {
                    //   console.log("⚡ BARGE-IN DETECTED");
                    //   session.bargeInDetected = true;
                    //   session.bargeInTranscript = transcriptOld;
                    //   clearProviderAudio(session);
                    //   setTimeout(() => {
                    //     session!.isAgentSpeaking = false;
                    //     flushTranscript(); // ← reset immediately so flush proceeds
                    //   }, 300); // Delay to allow for any pending audio processing
                    //   // clearProviderAudio(session);
                    //   // // ✅ immediately flush - don't rely on the debounce
                    //   // flushTranscript();
                    //   return;
                    // }
                    const wordCount = transcriptOld.trim().split(/\s+/).length;
                    const isInterruptKeyword = /\b(appointment|emergency|book|help|doctor|yes|no|stop|wait|hello|hi)\b/i.test(transcriptOld);
                    const minWords = isInterruptKeyword ? 1 : 2;
                    const minConfidence = isInterruptKeyword ? 0.7 : 0.85;
                    if (session?.isAgentSpeaking &&
                        event.isFinal &&
                        transcriptOld &&
                        event.confidence &&
                        event.confidence > minConfidence &&
                        wordCount >= minWords) {
                        // ) {
                        //   console.log("⚡ REAL-TIME BARGE-IN DETECTED");
                        //   session.isUserSpeaking = true;
                        //   // //session.lastInteractionAt = Date.now();
                        //   session.silenceWarningSent = false;
                        //   // //session.bargeInDetected = true;
                        //   session.responseId = (session.responseId || 0) + 1;
                        //   clearProviderAudio(session);
                        //   session.isAgentSpeaking = false;
                        //   session.isProcessingSpeech = false;
                        //   session.bargeInTranscript = transcriptOld;
                        //   // // STOP AI AUDIO IMMEDIATELY
                        //   // //clearProviderAudio(session);
                        //   // // RESET SPEAKING STATE IMMEDIATELY
                        //   // //session.isAgentSpeaking = false;
                        //   // // PROCESS USER SPEECH IMMEDIATELY
                        //   pendingTranscript = "";
                        //   const activeSession = session;
                        //   if (!activeSession) return;
                        //   enqueueSpeech(activeSession, transcriptOld).catch((err) => {
                        //     console.error("[BARGE-IN ENQUEUE ERROR]", err);
                        //     activeSession.isAgentSpeaking = false;
                        //     activeSession.bargeInDetected = false;
                        //   });
                        //   return;
                        // }
                    }
                    // ⚡ Trigger immediately on Final or speech_final
                    console.log("===== LINE B =====");
                    if (event.isFinal) {
                        console.log("===== LINE C =====");
                        console.log(`[STT] Final transcriptOld ("${transcriptOld}"), triggering LLM...`);
                        flushTranscript();
                    } //else {
                    //   transcriptOldDebounce = setTimeout(flushTranscript, 150); // Balanced trigger for interim
                    // }
                }, (error) => {
                    console.error("[STT ERROR]", error);
                }, {
                    language: session.language,
                    encoding: dgEncoding,
                    sampleRate: Number.isFinite(sampleRate) ? sampleRate : 8000,
                }, async () => {
                    //const queuedChunks = [...session!.audioQueue];
                    //session!.audioQueue = []; // Clear queue immediately to prevent duplicates
                    const queuedChunks = session.audioQueue.splice(0); // More efficient than creating a new array and clearing original
                    console.log(`✅ STT READY: Flushing ${queuedChunks.length} buffered audio chunks...`);
                    for (const chunk of queuedChunks) {
                        session.exotelInBuffer = Buffer.concat([
                            session.exotelInBuffer ?? Buffer.alloc(0),
                            chunk,
                        ]);
                        const sttChunk = session.provider === "exotel" ? 640 : 320;
                        while (session.exotelInBuffer.length >= sttChunk) {
                            const bufferedChunk = session.exotelInBuffer.subarray(0, sttChunk);
                            session.exotelInBuffer = session.exotelInBuffer.subarray(sttChunk);
                            // Prevent bot speech from being re-transcribed by flushing buffer immediately on ready, before processing any new audio
                            if (session.isAgentSpeaking && !session.bargeInDetected) {
                                continue;
                            }
                            session.stt.sendAudio(bufferedChunk);
                        }
                    }
                    session.sttReady = true;
                    if (!session.greetingPlayed && session.tts && !session.isEnding) {
                        try {
                            greetingStarted = true;
                            console.log("[Greeting] STT ready, starting greeting");
                            session.languageLocked = false;
                            session.step = "language_selection";
                            session.isAgentSpeaking = true;
                            session.bargeInDetected = false;
                            const greetingResponseId = session.responseId || 0;
                            if (greetingResponseId !== session.responseId) {
                                return;
                            }
                            await safeSpeak(session, session.responseId || 0, greeting);
                            await waitForExotelFlush(session);
                            sendMarkToProvider(session, "response-complete");
                            session.fullTranscript = `Agent: ${greeting}`;
                            console.log("[Greeting] Completed successfully");
                            if (session) {
                                const activeSession = session;
                                if (!activeSession)
                                    return;
                                activeSession.lastInteractionAt = Date.now();
                                activeSession.silenceWarningSent = false;
                            }
                        }
                        catch (err) {
                            console.error("[Greeting Error]", err);
                        }
                        finally {
                            session.isAgentSpeaking = false;
                            session.bargeInDetected = false;
                            session.isProcessingSpeech = false;
                            session.greetingPlayed = true;
                            // Start silence timer tracking AFTER greeting finishes
                            session.lastInteractionAt = Date.now();
                            // After greeting, wait for explicit language selection.
                            session.step = "language_selection";
                        }
                    }
                    // Flush any caller audio queued during the greeting
                    const postGreetingChunks = session.audioQueue.splice(0);
                    if (postGreetingChunks.length > 0) {
                        console.log(`[Greeting] Flushing ${postGreetingChunks.length} audio chunks queued during greeting`);
                        for (const chunk of postGreetingChunks) {
                            session.exotelInBuffer = Buffer.concat([
                                session.exotelInBuffer ?? Buffer.alloc(0),
                                chunk,
                            ]);
                            const postChunk = session.provider === "exotel" ? 640 : 320;
                            while (session.exotelInBuffer.length >= postChunk) {
                                const bufferedChunk = session.exotelInBuffer.subarray(0, postChunk);
                                session.exotelInBuffer = session.exotelInBuffer.subarray(postChunk);
                                session.stt.sendAudio(bufferedChunk);
                            }
                        }
                    }
                });
                // START STT (Async, but don't block)
                session.stt
                    .start()
                    .then(() => {
                    console.log("✅ Deepgram STT connection initiated");
                })
                    .catch((err) => {
                    console.error("❌ STT failed to start:", err);
                });
                // 🔥 FIX: Force sttReady after 3s timeout if Open event never fires
                // 🔥 SILENCE PADDING FOR EXOTEL (keeps call alive while Deepgram connects)
                if (provider === "exotel") {
                    const SILENCE_CHUNK = Buffer.alloc(3200);
                    const silencePad = setInterval(() => {
                        if (greetingStarted || session?.isEnding) {
                            clearInterval(silencePad);
                            return;
                        }
                        sendAudioToProvider(session, SILENCE_CHUNK);
                    }, 100);
                }
                // 🔥 FIX: Store watchdog in session so endCall() can cancel it
                // Increased to 8s to give exponential backoff time to succeed (1s+2s+4s)
                session.sttWatchdogTimer = setTimeout(async () => {
                    if (!session || session.isEnding || session.sttReady)
                        return;
                    console.error("❌ [STT Watchdog] Deepgram Open event never fired after 7s");
                    if (session.stt?.isActive()) {
                        // Edge case: isActive() uses isConnected — if this is true, onReady
                        // somehow didn't fire. Force sttReady and flush.
                        console.warn("⚠️ [STT Watchdog] isActive=true but sttReady=false — forcing ready");
                        session.sttReady = true;
                        // Flush buffered audio — sendAudio has isConnected guard so this is safe
                        session.exotelInBuffer = session.exotelInBuffer || Buffer.alloc(0);
                        for (const chunk of session.audioQueue) {
                            session.exotelInBuffer = Buffer.concat([session.exotelInBuffer, chunk]);
                        }
                        session.audioQueue = [];
                        const watchdogChunk = session.provider === "exotel" ? 640 : 320;
                        while (session.exotelInBuffer.length >= watchdogChunk) {
                            const c = session.exotelInBuffer.subarray(0, watchdogChunk);
                            session.exotelInBuffer = session.exotelInBuffer.subarray(watchdogChunk);
                            session.stt?.sendAudio(c);
                        }
                    }
                    else {
                        // Deepgram genuinely failed to connect
                        console.error("❌ [STT Watchdog] Deepgram not connected. Bot cannot hear caller.");
                        session.audioQueue = []; // drop buffered audio — no point keeping it
                        // Option A (recommended): Tell caller and stay on the line
                        // The bot can still speak (TTS still works), just can't hear
                        // You can inform the caller and keep the call alive for manual transfer
                        if (session.tts && !session.isEnding && session.greetingPlayed) {
                            try {
                                await session.tts.speak("I'm having trouble hearing you right now. Please stay on the line.", () => !!session?.isEnding);
                            }
                            catch (e) {
                                console.error("[STT Watchdog] TTS error:", e);
                            }
                        }
                        // Option B: Close the call entirely (uncomment if you prefer hard fail)
                        // setTimeout(() => { try { session.ws.close(); } catch(_){} }, 2000);
                    }
                }, 7000);
                // 3. Get/create conversation in BACKGROUND
                (async () => {
                    try {
                        // Fallback for organizationId if missing
                        let targetOrgId = organizationId || params.organizationId || params.organization_id;
                        if (!targetOrgId) {
                            const defaultOrg = await prisma.organization.findFirst();
                            targetOrgId = defaultOrg?.id || "";
                            console.log(`[Conversation] Using fallback Org: ${targetOrgId}`);
                        }
                        if (targetOrgId) {
                            // Find a valid agent for this organization
                            let targetAgentId = agentId || params.agentId || params.agent_id;
                            if (!targetAgentId || targetAgentId === "voice-ai") {
                                const defaultAgent = await prisma.agent.findFirst({
                                    where: { organizationId: targetOrgId },
                                });
                                targetAgentId = defaultAgent?.id || "";
                                console.log(`[Conversation] Using fallback Agent: ${targetAgentId}`);
                            }
                            let leadId;
                            if (session) {
                                try {
                                    const lead = await findOrCreateLeadForSession(session, targetOrgId);
                                    if (lead) {
                                        leadId = lead.id;
                                        session.leadId = lead.id;
                                    }
                                }
                                catch (leadError) {
                                    console.error("[Lead Create] Error:", leadError);
                                }
                            }
                            if (targetAgentId) {
                                const conversation = await prisma.conversation.create({
                                    data: {
                                        organizationId: targetOrgId,
                                        agentId: targetAgentId,
                                        channel: "VOICE",
                                        status: "ACTIVE",
                                        twilioCallSid: callSid,
                                        sessionId: streamSid,
                                        callDirection: direction,
                                        phoneTo: calledNumber,
                                        phoneFrom: callerNumber,
                                        detectedLanguage: session.language,
                                        startedAt: new Date(),
                                        ...(leadId ? { leadId } : {}),
                                    },
                                });
                                session.conversationId = conversation.id;
                                console.log(`[Conversation] Created: ${conversation.id}`);
                            }
                        }
                    }
                    catch (error) {
                        console.error("[Conversation Create] Error:", error);
                    }
                })();
                // // 3. Initialize TTS
                // try {
                //   session.tts = new SarvamLiveTTS(
                //     getSarvamVoiceId(session.language),
                //     (chunk) => {
                //       // Send audio back through provider websocket format
                //       sendAudioToProvider(session!, chunk);
                //     },
                //     undefined, // onComplete
                //     (error) => {
                //       console.error("[TTS] Error:", error);
                //     },
                //     session.provider === "exotel" ? "pcm16le8k" : "mulaw8k",
                //     //"mulaw8k",
                //   );
                // } catch (error: any) {
                //   console.error(
                //     "[TTS] Failed to initialize, keeping websocket alive:",
                //     error?.message || error,
                //   );
                //   session.tts = null;
                // }
                // Initialize Brain
                const _voiceHospitalName = process.env.HOSPITAL_NAME || "our hospital";
                const _voiceHospitalPhone = process.env.HOSPITAL_PHONE || "108";
                const _voiceHospitalAddress = process.env.HOSPITAL_ADDRESS || "";
                const _voiceAgentName = process.env.AGENT_NAME || "MedAssist";
                const systemPrompt = params.systemPrompt ||
                    `You are ${_voiceAgentName}, an AI healthcare assistant at ${_voiceHospitalName}.

           HOSPITAL INFORMATION (use ONLY these values, never fabricate):
- Name: ${_voiceHospitalName}
- Phone: ${_voiceHospitalPhone}
- Address: ${_voiceHospitalAddress}

Today's date is ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.
Current time is ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.

Your responsibilities:
- Understand user intent clearly
- Respond conversationally and naturally
- Ask ONE question at a time
- Route internally to the correct role
- Ensure safe and medically compliant responses

On FIRST contact, present these 3 options naturally:
1. Book an appointment with a specialist
2. Connect to our front desk for appointment help
3. Connect to an emergency doctor


Available Roles:
1. Front Desk → appointments, booking, scheduling
2. Triage Nurse → symptoms, urgency detection
3. Pharmacist → medicine info
4. Consultant → doctor/department suggestion
5. Scribe → summarizing patient info
6. Interpreter → language adaptation

Routing Logic:
- If user talks about booking → Front Desk
- If user mentions symptoms → Triage Nurse (ask if they want to elaborate on condition)
- If user asks about medicine → Pharmacist
- If user asks which doctor → Consultant
- If user asks to summarize → Scribe

RED ZONE — EMERGENCY DETECTION (CRITICAL):
If user mentions ANY of: chest pain, breathlessness, breathing difficulty, unconsciousness,
heavy or uncontrolled bleeding, wound, accident, fall, severe headache, weakness of hands or legs,
difficulty speaking, urinary obstruction, blood injury, or stroke symptoms.
→ Immediately respond: "This sounds like a medical emergency. Connecting you to emergency services now. Please call ${_voiceHospitalPhone} immediately."
→ Set requiresTransfer = true and route to Emergency Doctor role
→ NEVER ask follow-up questions or try to triage further — this is a red flag that the user is in danger and needs urgent human help

STRICT RULES — NEVER BREAK:
- Never diagnose or prescribe medicines
- Always recommend consulting a doctor
- If uncertain → suggest human assistance
- NEVER use filler phrases like "I'll help you with that", "Sure", "Of course", "Certainly"
- NEVER say "receptionist" more than once — use "front desk" or "our team" instead
- After booking confirmed: "Thank you for contacting ${_voiceHospitalName}. Have a great day!"

Conversation Style:
- Friendly, human-like, brief (maximum 2 short sentences)
- Use natural phrasing: "May I have..." instead of "Please provide..."
- Ask one question at a time
- Never re-ask for information the caller already gave (name, department, date, phone)
- Guide user step-by-step
- No bullet points or lists in voice responses`;
                session.brain = new GroqDualBrain({
                    systemPrompt: `${systemPrompt}

LANGUAGE RULES — MANDATORY, NEVER IGNORE:
- The caller's language is: ${session.language}
- You MUST respond ONLY in ${session.language}
- en-IN = English, hi-IN = Hindi, te-IN = Telugu, ta-IN = Tamil
- kn-IN = Kannada, ml-IN = Malayalam, mr-IN = Marathi
- bn-IN = Bengali, gu-IN = Gujarati, pa-IN = Punjabi, or-IN = Odia
- Write in the script of that language (Telugu script for te-IN, etc.)
- NEVER respond in English when language is not en-IN
- If you are unsure, default to ${session.language}`,
                    language: session.language,
                    enableTools: true,
                });
                if (session.provider === "exotel") {
                    session.heartbeatTimer = setInterval(() => {
                        sendProviderKeepAlive(session);
                    }, 15000);
                }
                break;
            }
            // ── Audio chunk ────────────────────────────────────────────────────
            case "media": {
                const streamSid = message.streamSid ||
                    message.stream_sid ||
                    message.start?.streamSid ||
                    message.start?.stream_sid;
                if (!session && streamSid) {
                    // 🔥 Handle orphan media (audio arriving before 'start' event)
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
                if (!session)
                    return;
                const audioPayload = message.media?.payload;
                if (!audioPayload || typeof audioPayload !== "string") {
                    console.log("❌ Invalid audio payload");
                    break;
                }
                const track = message.media?.track; // ← was missing
                if (track && track !== "inbound") {
                    break; // ← was missing (unclosed if)
                }
                // ✅ DEBUG 1: base64 payload size
                //console.log("📥 Payload size (base64):", audioPayload.length);
                let audioBuffer;
                try {
                    audioBuffer = Buffer.from(audioPayload, "base64");
                    if (process.env.DEBUG_MEDIA === "true") {
                        console.log(`[MEDIA] decoded=${audioBuffer.length} bytes sttReady=${session.sttReady}`);
                    }
                }
                catch {
                    console.log("❌ Failed to decode base64");
                    break;
                }
                // ✅ DEBUG 2: decoded audio size
                //console.log("📥 Decoded audio size:", audioBuffer.length);
                // 🔥 Buffer if STT not ready
                if (!session.sttReady || !session.stt) {
                    session.audioQueue.push(audioBuffer);
                    return;
                }
                // 🔥 FIX: Proper buffering for Exotel (3200 bytes)
                session.exotelInBuffer = session.exotelInBuffer || Buffer.alloc(0);
                session.exotelInBuffer = Buffer.concat([session.exotelInBuffer, audioBuffer]);
                // linear16 @ 8kHz = 2 bytes/sample × 8000/s = 16000 bytes/s → 40ms = 640 bytes
                // mulaw @ 8kHz = 1 byte/sample × 8000/s = 8000 bytes/s → 40ms = 320 bytes
                const TARGET_CHUNK = session.provider === "exotel" ? 640 : 320;
                while (session.exotelInBuffer.length >= TARGET_CHUNK) {
                    const chunk = session.exotelInBuffer.subarray(0, TARGET_CHUNK);
                    session.exotelInBuffer = session.exotelInBuffer.subarray(TARGET_CHUNK);
                    // Prevent bot voice loopback but preserve caller interruption audio
                    if (session.isAgentSpeaking && !session.bargeInDetected) {
                        if (session.audioQueue.length < 200) {
                            session.audioQueue.push(chunk);
                        }
                        continue;
                    }
                    // ✅ Send ONLY valid chunk to STT
                    await session.stt.sendAudio(chunk);
                    //console.log("✅ Sent chunk to STT:", chunk.length); // should always be 320
                }
                break;
            }
            // ── Call ended ─────────────────────────────────────────────────────
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
                if (!session)
                    break;
                // 🎯 When audio chunk finishes playing
                if (markName?.startsWith("audio-")) {
                    // This allows us to track playback progress on the PSTN leg.
                    // For now, we just log it since the end-of-response logic relies on `response-complete`
                    console.log(`✅ Chunk played: ${markName}`);
                }
                // 🎯 When full response audio finishes playing
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
    }
    catch (error) {
        console.error("[WebSocket] Error processing message:", error);
    }
}
/**
 * Handle WebSocket connection
 */
export async function handleWebSocketConnection(ws, req) {
    console.log("[WebSocket] New connection", {
        path: req?.url,
        remoteAddress: req?.socket?.remoteAddress,
        userAgent: req?.headers?.["user-agent"],
    });
    ws.on("message", (data) => {
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
    ws.on("error", (error) => {
        console.error("[WebSocket Error]", error);
    });
}
