/**
 * Deepgram Live STT - Real-time speech-to-text streaming
 * Handles 11 Indian languages + English with barge-in detection
 * SDK-compatible version for v5+
 */
//import WebSocket from "ws";
//import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { DeepgramClient } from "@deepgram/sdk";
import { getDeepgramLanguage, SupportedLanguage } from "./language-detection";

export interface STTConfig {
  language?: SupportedLanguage;
  model?: string;
  encoding?: string;
  sampleRate?: number;
}

export interface TranscriptEvent {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
}

export class DeepgramLiveSTT {
  private speechStarted = false;
  private deepgram: any;
  private connection: any = null;
  private language: SupportedLanguage;
  private model: string;
  private encoding: string;
  private sampleRate: number;
  private fullTranscript = "";
  private interimTranscript = "";
  private onTranscript: (event: TranscriptEvent) => void;
  private onError: (error: Error) => void;
  private isConnected = false;
  private onReady?: () => void;
  private keepAliveTimer?: NodeJS.Timeout;
  private stopped = false;
  private isReconnecting = false;
  private reconnectAttempts = 0;
  private hasOpened = false;
  private pendingAudio: Buffer[] = [];
  private readonly MAX_PENDING_AUDIO = 500;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;

  constructor(
    onTranscript: (event: TranscriptEvent) => void,
    onError?: (error: Error) => void,
    config: STTConfig = {},
    onReady?: () => void,
  ) {
    //     this.deepgram = createClient(process.env.DEEPGRAM_API_KEY!, {
    //   global: { WebSocket: WebSocket as any, fetch: fetch },
    // });
    this.deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY! });
    this.language = config.language || SupportedLanguage.EN;
    this.model = config.model || "nova-3"; // Use base nova-3 for better compatibility
    this.encoding = config.encoding || "mulaw";
    this.sampleRate = config.sampleRate || 8000;
    this.onTranscript = onTranscript;
    this.onError = onError || (() => { });
    this.onReady = onReady;
  }

  /**
   * Start a live transcription connection
   */
  async start(): Promise<void> {
    if (this.stopped) return;
    this.hasOpened = false;

    // Tear down any existing connection cleanly before opening a new one
    //await this._destroyConnection();

    try {
      const dgLang = getDeepgramLanguage(this.language);
      console.log("[DEEPGRAM LANGUAGE]", {
        originalLanguage: this.language,
        deepgramLanguage: dgLang,
      });
      const options: any = {
        model: this.model,
        // ...(dgLang !== "multi" ? { language: dgLang } : {}),
        // detect_language: dgLang === "multi",
        language: dgLang,
        smart_format: true,
        encoding: this.encoding,
        sample_rate: this.sampleRate,
        channels: 1,
        interim_results: true,
        //utterance_end_ms: 800,
        //vad_events: true,
        //endpointing: 250,
        punctuate: true,
      };

      // if (dgLang === "multi") {
      //   options.detect_language = true;
      // } else {
      //   options.language = dgLang;
      // }
      console.log("DEEPGRAM OPTIONS:", JSON.stringify(options, null, 2));
      // Store in local var first — so old close-events can detect they're stale
      const connection = await this.deepgram.listen.v1.connect(options);
      this.connection = connection;
      connection.connect();

      const handleOpen = () => {
        // Ensure we run this exactly once per connection.
        // If `open` fired before we attached the handler, `waitForOpen()` will still unblock,
        // and we call handleOpen() after it.
        if (this.hasOpened) return;

        console.log("🔥 Deepgram connection opened");
        this.hasOpened = true;
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.isReconnecting = false;

        this.onReady?.();

        if (this.pendingAudio.length > 0) {
          console.log(`[STT] Flushing ${this.pendingAudio.length} buffered chunks`);

          for (const chunk of this.pendingAudio) {
            try {
              const arrayBuffer = chunk.buffer.slice(
                chunk.byteOffset,
                chunk.byteOffset + chunk.byteLength,
              );

              connection.socket.send(arrayBuffer);
            } catch { }
          }

          this.pendingAudio = [];
        }

        // FIX: only call keepAlive(), never send("") — empty string closes the connection
        this.keepAliveTimer = setInterval(() => {
          try {
            if (
              this.connection === connection &&
              typeof connection.keepAlive === "function"
            ) {
              connection.keepAlive();
            }
          } catch (e) {
            console.error("[STT KeepAlive Error]", e);
          }
        }, 8000);
      };

      connection.on("open", handleOpen);

      // Wait for socket readiness, then run handleOpen() in case "open" already fired.
      await connection.waitForOpen();
      handleOpen();

      connection.on("error", (err: any) => {
        if (this.connection !== connection) return; // stale — ignore
        console.error("[STT Error] TYPE:", typeof err);
        console.error("[STT Error]", err?.message || err?.type || err);
        console.error("[STT Error] MSG:", err?.message);
        console.error("[STT Error] CODE:", err?.code || err?.type);
        this.onError(new Error(`STT Error: ${err?.message || JSON.stringify(err)}`));
      });

      connection.on("close", (code: any, reason: any) => {
        if (this.connection !== connection) return;
        console.log(`❌ Deepgram connection closed — code: ${code}, reason: ${String(reason)}`);
        this._clearKeepAlive();
        this.isConnected = false;

        if (this.stopped) return; // ← ADD THIS: don't reconnect if intentionally stopped

        if (!this.hasOpened) {
          console.error("❌ [STT] Initial Deepgram handshake failed");
          this.isReconnecting = false; // reset so _scheduleReconnect can proceed
          this._scheduleReconnect();
          return; // ← ADD THIS: prevent falling through to second block
        }

        if (!this.isReconnecting) {
          // ← simplified, isConnected already false
          this._scheduleReconnect();
        }
      });

      connection.on("message", (data: any) => {
        if (this.connection !== connection) return;

        if (data.type !== "Results") {
          return; // don't log every non-Results event
        }

        try {
          const alternative = data.channel?.alternatives?.[0];

          const transcript = alternative?.transcript ?? "";
          const confidence = alternative?.confidence ?? 0;

          const isFinal = data.is_final ?? false;
          const speechFinal = data.speech_final ?? false;

          const text = transcript.trim();

          // Priority 1 & 2: Filtering
          if (!text) {
            return;
          }
          if (confidence < 0.25) {
            return;
          }
          if (!speechFinal) { // only process speechFinal to avoid duplicates
            return;
          }

          // VAD-like logging
          if (!this.speechStarted) {
            console.log("🔊 Speech Started");
            this.speechStarted = true;
          }

          console.log("🔇 Speech Ended");
          console.log("📝 Final Transcript:", text);

          const event: TranscriptEvent = {
            transcript: text,
            confidence,
            isFinal: true,
          };

          this.onTranscript(event);

          this.speechStarted = false;
        } catch (err) {
          console.error("❌ STT Parse Error");
          console.error(err);
        }
      });

      console.log(`[STT] Started in ${dgLang} (${this.encoding}/${this.sampleRate}Hz)`);
    } catch (error: any) {
      console.error("[STT] Start error:", error);
      this.isConnected = false;
      this.hasOpened = false;
      this.onError(error);
      if (!this.stopped && !this.isConnected && !this.isReconnecting) {
        this._scheduleReconnect();
      }
    }
  }

  // Exponential backoff reconnect — only ONE timer ever pending at a time
  private _scheduleReconnect(): void {
    if (this.stopped || this.isReconnecting) return;
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error("[STT] Max reconnect attempts reached. Giving up.");
      this.onError(new Error("Deepgram: max reconnect attempts exceeded"));
      return;
    }
    this.isReconnecting = true;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 8000);
    this.reconnectAttempts++;
    console.log(`[STT] Reconnect attempt ${this.reconnectAttempts} in ${delay}ms...`);
    setTimeout(async () => {
      this.isReconnecting = false;
      if (this.stopped) return;
      try {
        await this.start();
      } catch (err) {
        console.error("[Deepgram Reconnect Failed]", err);
      }
    }, delay);
  }

  // Destroy current connection without triggering reconnect
  private async _destroyConnection(): Promise<void> {
    if (!this.connection) return;
    const old = this.connection;
    this.connection = null;
    this.isConnected = false;
    this._clearKeepAlive();

    try {
      if (typeof old.finish === "function") old.finish();
      else if (typeof old.requestClose === "function") old.requestClose();
      else if (typeof old.close === "function") old.close();
    } catch (_) { }
  }

  private _clearKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }
  }

  /**
   * Send audio chunk to STT
   */
  async sendAudio(audioChunk: Buffer): Promise<void> {
    if (!this.connection || !this.isConnected) {
      if (this.pendingAudio.length >= this.MAX_PENDING_AUDIO) {
        this.pendingAudio.shift();
      }

      this.pendingAudio.push(Buffer.from(audioChunk));

      return;
    }

    try {
      // ✅ DEBUG: log audio size
      //console.log("🎤 Audio chunk size:", audioChunk.length);

      // ✅ DEBUG: save raw audio for analysis
      if (process.env.DEBUG_AUDIO === "true") {
        const fs = await import("fs");
        fs.appendFile("debug.raw", audioChunk, () => { });
      }
      // const toSend =
      //   this.encoding === 'linear16'
      //     ? this.mulawToLinear16(audioChunk)
      //     : audioChunk;
      const toSend = audioChunk;

      if (toSend.length > 0) {
        if (typeof this.connection.send === "function") {
          this.connection.send(toSend);
        } else if (this.connection?.socket?.readyState === 1) {
          this.connection.socket.send(toSend);
        } else {
          console.warn("[STT] Connection not writable");
        }
      }
    } catch (error: any) {
      console.error("[STT] Send audio error:", error);
    }
  }

  /**
   * Convert mulaw to linear16
   */
  private mulawToLinear16(mulawBuf: Buffer): Buffer {
    const out = Buffer.alloc(mulawBuf.length * 2);
    for (let i = 0; i < mulawBuf.length; i++) {
      let mulaw = ~mulawBuf[i] & 0xff;
      const sign = mulaw & 0x80;
      const exp = (mulaw >> 4) & 0x07;
      const mantissa = mulaw & 0x0f;
      let sample = ((mantissa << 3) + 0x84) << (exp > 0 ? exp : 0);
      sample -= 0x84;
      if (sign) sample = -sample;
      out.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), i * 2);
    }
    return out;
  }

  /**
   * Stop the STT connection
   */
  // async stop(): Promise<void> {
  //   this.stopped = true; // Set stopped flag to prevent auto-reconnect
  //   if (!this.connection || !this.isConnected) return;

  //   try {
  //     console.log("[STT] Stopping connection...");
  //     // Defensive check for various SDK versions/states
  //     if (
  //       this.connection.finish &&
  //       typeof this.connection.finish === "function"
  //     ) {
  //       this.connection.finish();
  //     } else if (
  //       this.connection.requestClose &&
  //       typeof this.connection.requestClose === "function"
  //     ) {
  //       this.connection.requestClose();
  //     } else if (
  //       this.connection.close &&
  //       typeof this.connection.close === "function"
  //     ) {
  //       this.connection.close();
  //     }
  //   } catch (error: any) {
  //     console.log("[STT] Stop error (likely already closed):", error.message);
  //   } finally {
  //     if (this.keepAliveTimer) {
  //       clearInterval(this.keepAliveTimer);
  //       this.keepAliveTimer = undefined;
  //     }

  //     this.isConnected = false;
  //   }
  // }
  async stop(): Promise<void> {
    this.stopped = true;
    this.isReconnecting = false;
    await this._destroyConnection();
    console.log("[STT] Stopped.");
  }
  /**
   * Get current full transcript
   */
  getFullTranscript(): string {
    return this.fullTranscript.trim();
  }

  /**
   * Get interim transcript
   */
  getInterimTranscript(): string {
    return this.interimTranscript.trim();
  }

  /**
   * Reset transcripts
   */
  reset(): void {
    this.speechStarted = false;
    this.fullTranscript = "";
    this.interimTranscript = "";
  }

  /**
   * Check if connection is active
   */
  isActive(): boolean {
    return this.isConnected;
  }

  /**
   * Change language mid-call
   */
  /**
   * Change language mid-call.
   * Stops the current Deepgram connection and starts a new one with the new language.
   * Audio arriving during the reconnect window is buffered and replayed once ready.
   */
  async changeLanguage(newLanguage: SupportedLanguage): Promise<void> {
    if (newLanguage === this.language) return;
    console.log(`[STT] Language switch: ${this.language} → ${newLanguage}`);

    // Buffer audio during reconnect so nothing is dropped
    const reconnectBuffer: Buffer[] = [];
    const originalSendAudio = this.sendAudio.bind(this);

    // Temporarily redirect sendAudio to buffer
    this.sendAudio = async (chunk: Buffer) => {
      reconnectBuffer.push(chunk);
    };

    // Stop old connection
    await this.stop();

    this.stopped = false; // Reset stopped flag to allow new connection

    // Update language
    this.language = newLanguage;
    this.isConnected = false;
    this.speechStarted = false;
    //await this.start();

    // Wrap onReady to flush the reconnect buffer once new connection is open
    const originalOnReady = this.onReady;
    this.onReady = () => {
      // Restore real sendAudio first
      this.sendAudio = originalSendAudio;

      // Call original onReady (sets sttReady, flushes session audioQueue)
      if (originalOnReady) originalOnReady();

      // Replay buffered audio from reconnect window
      if (reconnectBuffer.length > 0) {
        console.log(
          `[STT] Replaying ${reconnectBuffer.length} chunks buffered during language switch`,
        );
        for (const chunk of reconnectBuffer) {
          originalSendAudio(chunk).catch(() => { });
        }
        reconnectBuffer.length = 0;
      }
    };

    // Start new connection with new language
    await this.start();
  }
}
