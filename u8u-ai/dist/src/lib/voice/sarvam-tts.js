/**
 * Sarvam AI TTS - Drop-in replacement for AzureLiveTTS
 * Same constructor signature, same streaming behavior, same chunk sizes and pacing.
 * Uses axios (no SDK) — reliable for production voice bots.
 *
 * Install: npm install axios
 * ENV:     SARVAM_API_KEY=your_key_here
 */
import axios from "axios";
// Sarvam speaker per language — female voices preferred to match Azure mapping
const SARVAM_VOICE_MAP = {
    "en-IN": "ritu", // female, clear Indian English
    "hi-IN": "roopa", // female, natural Hindi
    "kn-IN": "kavya", // female, Kannada
    "ta-IN": "priya", // female, Tamil
    "te-IN": "priya", // female, Telugu
    "ml-IN": "priya", // female, Malayalam
    "mr-IN": "roopa", // female, Marathi
    "bn-IN": "priya", // female, Bengali
    "gu-IN": "priya", // female, Gujarati
    "pa-IN": "rahul", // male (limited female support for Punjabi)
    "or-IN": "rahul", // male (limited female support for Odia)
};
/**
 * Maps an Azure-style voiceId (e.g. "kn-IN-SapnaNeural")
 * to a Sarvam { language_code, speaker } pair.
 */
function azureVoiceToSarvam(voiceId) {
    // voiceId format: "kn-IN-SapnaNeural"
    const parts = voiceId.split("-");
    const langCode = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : "en-IN";
    const speaker = SARVAM_VOICE_MAP[langCode] ?? "ritu";
    return { language_code: langCode, speaker };
}
/**
 * Convert raw PCM 16-bit LE samples to 8-bit mu-law
 * (Needed when Exotel is NOT in use and the provider expects mulaw)
 */
function linearToMulaw(sample) {
    const BIAS = 33;
    const CLIP = 32635;
    let sign = 0;
    if (sample < 0) {
        sign = 0x80;
        sample = -sample;
    }
    if (sample > CLIP)
        sample = CLIP;
    sample += BIAS;
    let exp = 7;
    for (let e = 0; e < 8; e++) {
        if (sample <= 0xff >> (7 - e)) {
            exp = e;
            break;
        }
    }
    const mantissa = (sample >> (exp + 3)) & 0x0f;
    return ~(sign | (exp << 4) | mantissa) & 0xff;
}
function pcmToMulaw(pcmBuf) {
    const out = Buffer.alloc(pcmBuf.length / 2);
    for (let i = 0; i < out.length; i++) {
        const pcm = pcmBuf.readInt16LE(i * 2);
        out[i] = linearToMulaw(pcm);
    }
    return out;
}
/**
 * Strip a WAV header and return raw PCM bytes.
 * Sarvam returns WAV; we need raw PCM 16-bit LE @ 8kHz.
 * Standard WAV header is 44 bytes, but we scan for the "data" chunk
 * to be safe with non-standard headers.
 */
function stripWavHeader(wavBuf) {
    // Scan for "data" marker
    for (let i = 0; i < Math.min(wavBuf.length - 4, 200); i++) {
        if (wavBuf[i] === 0x64 && // d
            wavBuf[i + 1] === 0x61 && // a
            wavBuf[i + 2] === 0x74 && // t
            wavBuf[i + 3] === 0x61 // a
        ) {
            // skip "data" (4) + chunk size (4) = 8 bytes
            return wavBuf.subarray(i + 8);
        }
    }
    // Fallback: skip standard 44-byte header
    return wavBuf.subarray(44);
}
export class SarvamLiveTTS {
    voiceId;
    outputFormat;
    onAudioChunk;
    onComplete;
    onError;
    apiKey;
    streamTimer;
    retryTimer;
    cancelled = false;
    destroyed = false;
    // ── Constructor signature matches AzureLiveTTS exactly ──────────────────
    constructor(voiceId = "en-IN-NeerjaNeural", onAudioChunk, onComplete, onError, outputFormat = "mulaw8k") {
        this.voiceId = voiceId;
        this.outputFormat = outputFormat;
        this.onAudioChunk = onAudioChunk;
        this.onComplete = onComplete;
        this.onError = onError ?? (() => { });
        this.apiKey = process.env.SARVAM_API_KEY;
        if (!this.apiKey) {
            console.warn("[SARVAM TTS] SARVAM_API_KEY is not set. TTS will fail.");
        }
    }
    // ── speak() — same signature as AzureLiveTTS ────────────────────────────
    async speak(text, isEndingCheck) {
        if (!text?.trim())
            return;
        this.cancelled = false;
        this.destroyed = false;
        console.log(`[TTS] Sarvam preparing: "${text.substring(0, 50)}..."`);
        return new Promise(async (resolve, reject) => {
            let retryCount = 0;
            const maxRetries = 3;
            const attemptSpeak = async () => {
                try {
                    const { language_code, speaker } = azureVoiceToSarvam(this.voiceId);
                    // ── Sarvam REST call ─────────────────────────────────────────
                    const response = await axios.post("https://api.sarvam.ai/text-to-speech", {
                        inputs: [text],
                        target_language_code: language_code,
                        speaker,
                        model: "bulbul:v3",
                        pace: 0.88, // Slightly slower for natural telephony delivery
                        speech_sample_rate: 8000,
                        temperature: 0.6, // v3 only: controls voice randomness (0.01–1.0)
                        // pitch: removed       — v3 ignores it
                        // loudness: removed    — v3 ignores it
                        // enable_preprocessing: removed — always on in v3
                        // eng_interpolation_wt: removed — not a v3 param
                    }, {
                        headers: {
                            "api-subscription-key": this.apiKey,
                            "Content-Type": "application/json",
                        },
                        timeout: 10000,
                    });
                    if (this.cancelled || this.destroyed) {
                        resolve();
                        return;
                    }
                    // Sarvam returns: { audios: [ "<base64 wav>" ] }
                    const base64Audio = response.data?.audios?.[0];
                    if (!base64Audio) {
                        throw new Error("[SARVAM TTS] No audio returned from API");
                    }
                    const wavBuffer = Buffer.from(base64Audio, "base64");
                    let pcmBuffer = stripWavHeader(wavBuffer);
                    // If provider needs mulaw, convert now
                    if (this.outputFormat === "mulaw8k") {
                        pcmBuffer = pcmToMulaw(pcmBuffer);
                    }
                    // ── Stream chunks with same sizing & pacing as Azure ─────────
                    // Exotel: 3200 bytes @ 100ms   |   Twilio: 320 bytes @ 20ms
                    const chunkSize = this.outputFormat === "pcm16le8k" ? 3200 : 320;
                    const pace = this.outputFormat === "pcm16le8k" ? 100 : 20;
                    let offset = 0;
                    //let streamTimer: NodeJS.Timeout | null = null;
                    this.streamTimer = undefined;
                    // const streamNext = () => {
                    //   // Barge-in / call-ended check
                    //   if (isEndingCheck?.()) {
                    //     console.log("[TTS] Stopping stream: call ended");
                    //     if (streamTimer) {
                    //       clearTimeout(streamTimer);
                    //       streamTimer = null;
                    //     }
                    //     resolve();
                    //     return;
                    //   }
                    //   if (offset + chunkSize <= pcmBuffer.length) {
                    //     // Normal chunk
                    //     const chunk = pcmBuffer.subarray(offset, offset + chunkSize);
                    //     this.onAudioChunk(chunk);
                    //     offset += chunkSize;
                    //     streamTimer = setTimeout(streamNext, pace);
                    //   } else {
                    //     // Final partial chunk — pad to valid size (same logic as Azure)
                    //     const remaining = pcmBuffer.subarray(offset);
                    //     if (remaining.length > 0) {
                    //       let finalChunk = remaining;
                    //       if (this.outputFormat === "pcm16le8k") {
                    //         // Align to 320-byte boundary
                    //         const mod320 = finalChunk.length % 320;
                    //         if (mod320 !== 0) {
                    //           finalChunk = Buffer.concat([finalChunk, Buffer.alloc(320 - mod320)]);
                    //         }
                    //         // Pad to minimum 3200 bytes
                    //         if (finalChunk.length < 3200) {
                    //           finalChunk = Buffer.concat([
                    //             finalChunk,
                    //             Buffer.alloc(3200 - finalChunk.length),
                    //           ]);
                    //         }
                    //       }
                    //       this.onAudioChunk(finalChunk);
                    //     }
                    //     if (streamTimer) {
                    //       clearTimeout(streamTimer);
                    //       streamTimer = null;
                    //     }
                    //     this.onComplete?.();
                    //     resolve();
                    //   }
                    // };
                    const streamNext = () => {
                        // Immediate interruption
                        if (this.cancelled || this.destroyed) {
                            console.log("[TTS] Streaming cancelled");
                            if (this.streamTimer) {
                                clearTimeout(this.streamTimer);
                                this.streamTimer = undefined;
                            }
                            resolve();
                            return;
                        }
                        // Existing call ended check
                        if (isEndingCheck?.()) {
                            console.log("[TTS] Stopping stream: call ended");
                            if (this.streamTimer) {
                                clearTimeout(this.streamTimer);
                                this.streamTimer = undefined;
                            }
                            resolve();
                            return;
                        }
                        if (offset + chunkSize <= pcmBuffer.length) {
                            const chunk = pcmBuffer.subarray(offset, offset + chunkSize);
                            this.onAudioChunk(chunk);
                            offset += chunkSize;
                            this.streamTimer = setTimeout(streamNext, pace);
                            return;
                        }
                        const remaining = pcmBuffer.subarray(offset);
                        if (remaining.length > 0) {
                            let finalChunk = remaining;
                            if (this.outputFormat === "pcm16le8k") {
                                const mod320 = finalChunk.length % 320;
                                if (mod320 !== 0) {
                                    finalChunk = Buffer.concat([
                                        finalChunk,
                                        Buffer.alloc(320 - mod320),
                                    ]);
                                }
                                if (finalChunk.length < 3200) {
                                    finalChunk = Buffer.concat([
                                        finalChunk,
                                        Buffer.alloc(3200 - finalChunk.length),
                                    ]);
                                }
                            }
                            this.onAudioChunk(finalChunk);
                        }
                        if (this.streamTimer) {
                            clearTimeout(this.streamTimer);
                            this.streamTimer = undefined;
                        }
                        this.onComplete?.();
                        resolve();
                    };
                    streamNext();
                }
                catch (err) {
                    const isRetryable = err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT" || err?.response?.status >= 500;
                    if (isRetryable && retryCount < maxRetries) {
                        retryCount++;
                        console.warn(`[SARVAM TTS] Retry ${retryCount}/${maxRetries}`);
                        this.retryTimer = setTimeout(attemptSpeak, 500);
                    }
                    else {
                        console.error("[SARVAM TTS ERROR]", err?.message ?? err);
                        this.onError?.(err instanceof Error ? err : new Error(String(err)));
                        reject(err);
                    }
                }
            };
            attemptSpeak();
        });
    }
    // ── speakSSML — Azure had this; we strip tags and use plain speak() ──────
    async speakSSML(text, _rate = "medium", _pitch = "medium") {
        // Sarvam doesn't support SSML. Strip tags and call speak().
        const plain = text
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        return this.speak(plain);
    }
    // ── changeVoice — same signature as Azure ───────────────────────────────
    async changeVoice(newVoiceId) {
        if (newVoiceId === this.voiceId)
            return;
        console.log(`[SARVAM TTS] Switching voice from ${this.voiceId} to ${newVoiceId}`);
        this.voiceId = newVoiceId;
    }
    // ── Static helper — same as Azure ───────────────────────────────────────
    static splitIntoSentences(text) {
        return text
            .replace(/([.!?])\s+/g, "$1|")
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean);
    }
    // ── Lifecycle — same stubs as Azure ─────────────────────────────────────
    close() {
        this.cancelled = true;
        if (this.streamTimer) {
            clearTimeout(this.streamTimer);
            this.streamTimer = undefined;
        }
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = undefined;
        }
    }
    destroy() {
        this.destroyed = true;
        this.close();
    }
    stop() {
        this.close();
    }
}
