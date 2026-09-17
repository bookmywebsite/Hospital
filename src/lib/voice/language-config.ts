// ── Language Configuration for 10 Indian Languages ───────────────────────────
// No Azure required — uses Twilio's built-in Google/Polly voices

export interface LanguageConfig {
  code:            string;
  name:            string;
  nativeName:      string;
  twilioLanguage:  string;
  twilioVoice:     string;
  sttLanguage:     string;
  greeting:        string; // Pre-built greeting in that language
  flagEmoji:       string;
}

export const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  EN: {
    code:           'EN',
    name:           'English',
    nativeName:     'English',
    twilioLanguage: 'en-IN',
    twilioVoice:    'Polly.Aditi',
    sttLanguage:    'en-IN',
    flagEmoji:      '🇮🇳',
    greeting:       `Welcome to {hospital}. You can say: book an appointment. Emergency. Or connect to front desk. How may I help you today?`,
  },
  HI: {
    code:           'HI',
    name:           'Hindi',
    nativeName:     'हिन्दी',
    twilioLanguage: 'hi-IN',
    twilioVoice:    'Polly.Aditi',
    sttLanguage:    'hi-IN',
    flagEmoji:      '🇮🇳',
    greeting:       `{hospital} में आपका स्वागत है। आप कह सकते हैं: अपॉइंटमेंट बुक करें। इमरजेंसी। या फ्रंट डेस्क से जुड़ें। मैं आपकी कैसे मदद कर सकता हूँ?`,
  },
  TA: {
    code:           'TA',
    name:           'Tamil',
    nativeName:     'தமிழ்',
    twilioLanguage: 'ta-IN',
    twilioVoice:    'Polly.Aditi',
    sttLanguage:    'ta-IN',
    flagEmoji:      '🇮🇳',
    greeting:       'வணக்கம் {name}, நான் {agent}, {hospital}-இல் இருந்து அழைக்கிறேன். நீங்கள் எப்படி இருக்கிறீர்கள்?',
  },
  TE: {
    code:           'TE',
    name:           'Telugu',
    nativeName:     'తెలుగు',
    twilioLanguage: 'te-IN',
    twilioVoice:    'Polly.Aditi',
    sttLanguage:    'te-IN',
    flagEmoji:      '🇮🇳',
    greeting:       'నమస్కారం {name}, నేను {agent}, {hospital} నుండి కాల్ చేస్తున్నాను. మీరు ఎలా ఉన్నారు?',
  },
  KN: {
    code:           'KN',
    name:           'Kannada',
    nativeName:     'ಕನ್ನಡ',
    twilioLanguage: 'kn-IN',
    twilioVoice:    'Polly.Aditi',
    sttLanguage:    'kn-IN',
    flagEmoji:      '🇮🇳',
    greeting:       `{hospital} ಗೆ ಸ್ವಾಗತ. ನೀವು ಹೇಳಬಹುದು: ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಬುಕ್ ಮಾಡಿ. ತುರ್ತು ಸಹಾಯ. ಅಥವಾ ಫ್ರಂಟ್ ಡೆಸ್ಕ್ ಗೆ ಸಂಪರ್ಕಿಸಿ. ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?`,
  },
  ML: {
    code:           'ML',
    name:           'Malayalam',
    nativeName:     'മലയാളം',
    twilioLanguage: 'ml-IN',
    twilioVoice:    'Polly.Aditi',
    sttLanguage:    'ml-IN',
    flagEmoji:      '🇮🇳',
    greeting:       'നമസ്കാരം {name}, ഞാൻ {agent}, {hospital}-ൽ നിന്ന് വിളിക്കുന്നു. സുഖമാണോ?',
  },
  MR: {
    code:           'MR',
    name:           'Marathi',
    nativeName:     'मराठी',
    twilioLanguage: 'mr-IN',
    twilioVoice:    'Polly.Aditi',
    sttLanguage:    'mr-IN',
    flagEmoji:      '🇮🇳',
    greeting:       'नमस्कार {name}, मी {agent}, {hospital} वरून कॉल करत आहे. तुम्ही कसे आहात?',
  },
  BN: {
    code:           'BN',
    name:           'Bengali',
    nativeName:     'বাংলা',
    twilioLanguage: 'bn-IN',
    twilioVoice:    'Polly.Aditi',
    sttLanguage:    'bn-IN',
    flagEmoji:      '🇮🇳',
    greeting:       'নমস্কার {name}, আমি {agent}, {hospital} থেকে কল করছি। আপনি কেমন আছেন?',
  },
  GU: {
    code:           'GU',
    name:           'Gujarati',
    nativeName:     'ગુજરાતી',
    twilioLanguage: 'gu-IN',
    twilioVoice:    'Polly.Aditi',
    sttLanguage:    'gu-IN',
    flagEmoji:      '🇮🇳',
    greeting:       'નમસ્તે {name}, હું {agent}, {hospital} તરફથી કૉલ કરી રહ્યો છું. તમે કેમ છો?',
  },
  PA: {
    code:           'PA',
    name:           'Punjabi',
    nativeName:     'ਪੰਜਾਬੀ',
    twilioLanguage: 'pa-IN',
    twilioVoice:    'Polly.Aditi',
    sttLanguage:    'pa-IN',
    flagEmoji:      '🇮🇳',
    greeting:       'ਸਤ ਸ੍ਰੀ ਅਕਾਲ {name}, ਮੈਂ {agent}, {hospital} ਤੋਂ ਕਾਲ ਕਰ ਰਿਹਾ ਹਾਂ। ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?',
  },
  OR: {
    code:           'OR',
    name:           'Odia',
    nativeName:     'ଓଡ଼ିଆ',
    twilioLanguage: 'or-IN',
    twilioVoice:    'Polly.Aditi',
    sttLanguage:    'or-IN',
    flagEmoji:      '🇮🇳',
    greeting:       'ନମସ୍କାର {name}, ମୁଁ {agent}, {hospital} ରୁ କଲ୍ କରୁଛି। ଆପଣ କେମିତି ଅଛନ୍ତି?',
  },
};

// ── Helper functions ──────────────────────────────────────────────────────────

export function getVoiceConfig(languageCode: string): LanguageConfig {
  const config = LANGUAGE_CONFIGS[languageCode?.toUpperCase()];
  if (!config) {
    console.warn(`Language ${languageCode} not supported, falling back to English`);
    return LANGUAGE_CONFIGS.EN;
  }
  return config;
}

export function getSupportedLanguages(): LanguageConfig[] {
  return Object.values(LANGUAGE_CONFIGS);
}

export function isLanguageSupported(languageCode: string): boolean {
  return languageCode?.toUpperCase() in LANGUAGE_CONFIGS;
}

export function generateGreeting(
  agentName: string,
  leadName: string | null | undefined,
  languageCode: string
): string {
  const config = getVoiceConfig(languageCode);
  const name   = leadName ?? 'Sir';
  const hospitalName = process.env.HOSPITAL_NAME || 'our hospital';
  return config.greeting
    .replace('{name}',     name)
    .replace('{agent}',    agentName)
    .replace('{hospital}', hospitalName);
}

// Detect language from text using simple heuristics
export function detectLanguageFromText(text: string): string {
  const patterns: Record<string, RegExp> = {
    HI: /[\u0900-\u097F]/,      // Devanagari (Hindi/Marathi)
    TA: /[\u0B80-\u0BFF]/,      // Tamil
    TE: /[\u0C00-\u0C7F]/,      // Telugu
    KN: /[\u0C80-\u0CFF]/,      // Kannada
    ML: /[\u0D00-\u0D7F]/,      // Malayalam
    BN: /[\u0980-\u09FF]/,      // Bengali
    GU: /[\u0A80-\u0AFF]/,      // Gujarati
    PA: /[\u0A00-\u0A7F]/,      // Punjabi/Gurmukhi
    OR: /[\u0B00-\u0B7F]/,      // Odia
    MR: /[\u0900-\u097F]/,      // Marathi (same as Hindi script)
  };

  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) return lang;
  }

  return 'EN'; // Default to English
}