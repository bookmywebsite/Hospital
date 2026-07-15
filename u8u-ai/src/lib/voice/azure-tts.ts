/**
 * Azure Speech TTS - Text-to-Speech with Streaming
 * Converts text to natural-sounding Indian voice audio
 * Streams output in 20ms chunks (mulaw/8kHz) compatible with Twilio
 */

import * as sdk from "microsoft-cognitiveservices-speech-sdk";

export interface TTSChunk {
  audio: Buffer;
  durationMs: number;
}

export type TTSOutputFormat = "mulaw8k" | "pcm16le8k";

export class AzureLiveTTS {
  //private synthesizer: sdk.SpeechSynthesizer | null = null;
  private speechConfig: sdk.SpeechConfig;
  private voiceId: string;
  private language: string;
  private outputFormat: TTSOutputFormat;
  private onAudioChunk: (chunk: Buffer) => void;
  private onComplete?: () => void;
  private onError?: (error: Error) => void;

  constructor(
    voiceId: string = "en-IN-NeerjaNeural",
    onAudioChunk: (chunk: Buffer) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void,
    outputFormat: TTSOutputFormat = "mulaw8k",
  ) {
    this.voiceId = voiceId;
    this.outputFormat = outputFormat;
    this.onAudioChunk = onAudioChunk;
    this.onComplete = onComplete;
    this.onError = onError || (() => {});

    // Extract language from voice ID (e.g., 'en-IN' from 'en-IN-NeerjaNeural')
    this.language = voiceId.split("-").slice(0, 2).join("-") || "en-IN";

    // Initialize Azure Speech config
    this.speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY!,
      process.env.AZURE_SPEECH_REGION || "centralindia",
    );

    // Twilio prefers mulaw, Exotel bidirectional expects PCM16 little-endian.
    this.speechConfig.speechSynthesisOutputFormat =
      this.outputFormat === "pcm16le8k"
        ? sdk.SpeechSynthesisOutputFormat.Raw8Khz16BitMonoPcm
        : sdk.SpeechSynthesisOutputFormat.Raw8Khz8BitMonoMULaw;

    // Set voice
    this.speechConfig.speechSynthesisVoiceName = this.voiceId;

    // Create synthesizer with pull audio stream
    // const audioConfig = sdk.AudioConfig.fromStreamOutput(
    //   sdk.AudioOutputStream.createPullStream()
    // );
    //this.synthesizer = new sdk.SpeechSynthesizer(this.speechConfig, audioConfig);
  }

  /**
   * Convert PCM 16-bit audio to 8-bit mu-law
   * (Used internally; Azure SDK handles most conversion)
   */
  private linearToMulaw(sample: number): number {
    const BIAS = 33;
    const CLIP = 32635;
    let sign = 0;
    if (sample < 0) {
      sign = 0x80;
      sample = -sample;
    }
    if (sample > CLIP) sample = CLIP;
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

  /**
   * Convert raw PCM 16-bit buffer to 8-bit mu-law
   */
  private pcmToMulaw(pcmBuf: Buffer): Buffer {
    const out = Buffer.alloc(pcmBuf.length / 2);
    for (let i = 0; i < out.length; i++) {
      const pcm = pcmBuf.readInt16LE(i * 2);
      out[i] = this.linearToMulaw(pcm);
    }
    return out;
  }

  /**
   * Speak plain text
   */
  async speak(text: string, isEndingCheck?: () => boolean): Promise<void> {
    if (!text?.trim()) {
      return;
    }

    console.log(`[TTS] Preparing to speak: "${text.substring(0, 50)}..."`);

    return new Promise((resolve, reject) => {
      const audioConfig = sdk.AudioConfig.fromStreamOutput(
        sdk.AudioOutputStream.createPullStream(),
      );

      const synthesizer = new sdk.SpeechSynthesizer(
        this.speechConfig,
        audioConfig,
      );
      let retryCount = 0;
      const maxRetries = 3;
      let isSynthesisDone = false;
      let audioQueue: Buffer[] = [];
      let isStreaming = false;
      let streamTimer: NodeJS.Timeout | null = null;

      const attemptSpeak = () => {
        try {
          // Listen for synthesis events to stream audio in real-time
          synthesizer!.synthesizing = (s, e) => {
            const audioData = Buffer.from(e.result.audioData);
            if (audioData.length > 0) {
              if (audioQueue.length > 100) {
                audioQueue.shift();
              }
              audioQueue.push(audioData);
              if (!isStreaming) {
                startStreaming();
              }
            }
          };

          const startStreaming = () => {
            isStreaming = true;

            // Twilio: 160 bytes (~20ms @ mulaw 8k), Exotel: 3200 bytes (100ms @ pcm16 8k)
            // Exotel requires minimum 100ms chunks (3200 bytes for 16k, 1600 for 8k)
            const chunkSize = this.outputFormat === "pcm16le8k" ? 3200 : 320;
            let currentBuffer = Buffer.alloc(0);

            const streamNext = () => {
              // Stop if call has ended
              if (isEndingCheck && isEndingCheck()) {
                console.log("[TTS] Stopping stream: Call ended");
                if (streamTimer) {
                  clearTimeout(streamTimer);
                  streamTimer = null;
                }
                resolve();
                return;
              }

              // Pull from queue into currentBuffer
              while (audioQueue.length > 0) {
                currentBuffer = Buffer.concat([
                  currentBuffer,
                  audioQueue.shift()!,
                ]);
              }

              if (currentBuffer.length >= chunkSize) {
                const chunk = currentBuffer.subarray(0, chunkSize);
                currentBuffer = currentBuffer.subarray(chunkSize);
                this.onAudioChunk(chunk);

                // Match timer to chunk duration: 100ms for Exotel (1600B), 20ms for Twilio (160B)
                const pace = this.outputFormat === "pcm16le8k" ? 100 : 20;
                streamTimer = setTimeout(streamNext, pace);
              } else if (isSynthesisDone) {
                // Final flush if anything left
                if (currentBuffer.length > 0) {
                  if (this.outputFormat === "pcm16le8k") {
                    const remainder = currentBuffer.length % 320;

                    if (remainder !== 0) {
                      currentBuffer = Buffer.concat([
                        currentBuffer,
                        Buffer.alloc(320 - remainder),
                      ]);
                    }

                    if (currentBuffer.length < 3200) {
                      currentBuffer = Buffer.concat([
                        currentBuffer,
                        Buffer.alloc(3200 - currentBuffer.length),
                      ]);
                    }
                  }

                  this.onAudioChunk(currentBuffer);
                }
                if (this.onComplete) this.onComplete();

                synthesizer.close();

                if (streamTimer) {
                  clearTimeout(streamTimer);
                  streamTimer = null;
                }
                resolve();
              } else {
                // Wait for more data
                streamTimer = setTimeout(streamNext, 20);
              }
            };

            streamNext();
          };

          synthesizer!.speakTextAsync(
            text,
            (result) => {
              if (
                result.reason === sdk.ResultReason.SynthesizingAudioCompleted
              ) {
                console.log(`[TTS] Synthesis fully completed`);
                isSynthesisDone = true;
                // If synthesis finished before we even started streaming (rare for long text)
                if (!isStreaming) {
                  audioQueue.push(Buffer.from(result.audioData));
                  startStreaming();
                }
              } else {
                const errorMsg = `TTS failed: ${result.reason} - ${result.errorDetails}`;
                console.error(`[TTS Error] ${errorMsg}`);

                if (
                  result.errorDetails?.includes("Websocket not ready") &&
                  retryCount < maxRetries
                ) {
                  retryCount++;
                  setTimeout(attemptSpeak, 500);
                  return;
                }

                const error = new Error(errorMsg);
                this.onError?.(error);
                synthesizer.close();
                if (streamTimer) {
                  clearTimeout(streamTimer);
                  streamTimer = null;
                }
                reject(error);
              }
            },
            (err) => {
              console.error("[TTS Async Error]", err);
              if (
                err.toString().includes("Websocket not ready") &&
                retryCount < maxRetries
              ) {
                retryCount++;
                setTimeout(attemptSpeak, 500);
                return;
              }
              synthesizer.close();
              if (streamTimer) {
                clearTimeout(streamTimer);
                streamTimer = null;
              }
              reject(err);
            },
          );
        } catch (e: any) {
          console.error("[TTS Catch Error]", e);
          synthesizer.close();
          if (streamTimer) {
            clearTimeout(streamTimer);
            streamTimer = null;
          }
          reject(e);
        }
      };

      attemptSpeak();
    });
  }

  /**
   * Speak text with SSML for more control
   * Useful for adding pauses, emphasis, rate control
   */
  async speakSSML(
    text: string,
    rate: string = "medium",
    pitch: string = "medium",
  ): Promise<void> {
    if (!text?.trim()) {
      return;
    }

    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${this.language}'>
      <voice name='${this.voiceId}'>
        <prosody rate='${rate}' pitch='${pitch}'>
          ${this.escapeXML(text)}
        </prosody>
      </voice>
    </speak>`;

    return this.speak(ssml);
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Split response into sentences for streaming
   */
  static splitIntoSentences(text: string): string[] {
    return text
      .replace(/([.!?])\s+/g, "$1|")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /**
   * Change voice mid-call
   */
  async changeVoice(newVoiceId: string): Promise<void> {
    if (newVoiceId === this.voiceId) return;

    console.log(
      `[Azure TTS] Switching voice from ${this.voiceId} to ${newVoiceId}`,
    );
    this.voiceId = newVoiceId;
    this.language = newVoiceId.split("-").slice(0, 2).join("-") || "en-IN";

    // Update synthesizer voice
    this.speechConfig.speechSynthesisVoiceName = newVoiceId;
  }

  /**
   * Cleanup
   */
  close(): void {
    // if (synthesizer) {
    //   synthesizer.close();
    //   synthesizer = null;
    // }
  }

  /**
   * Destructor
   */
  destroy(): void {
    this.close();
  }
}
