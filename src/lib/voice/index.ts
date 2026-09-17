/**
 * Voice AI Streaming - Export Index
 * Central place to import all voice AI modules
 */

export { DeepgramLiveSTT } from './deepgram-stt';
//export { AzureLiveTTS } from './azure-tts';
//export { SarvamLiveTTS } from './sarvam-tts';
export { CartesiaLiveTTS } from './cartesiaTTS';
export type { TTSOutputFormat } from './cartesiaTTS';
export { GroqDualBrain } from './groq-brain';
export {
  detectLanguage,
  isEmergency,
  getSarvamVoiceId,
  getDeepgramLanguage,
  getLanguageName,
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
  type DetectionResult,
  type LanguageDetectionConfig,
} from './language-detection';
export { handleWebSocketConnection, handleWebSocketMessage } from './websocket-handler';
