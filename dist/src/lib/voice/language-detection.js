/**
 * Advanced Language Detection for 11 Indian Languages + English
 * with Unicode range detection, keyword patterns, and fallback strategies
 */
// ─── Supported Languages Configuration ───────────────────────────────────────
export const SupportedLanguage = {
    EN: "en-IN",
    HI: "hi-IN",
    KN: "kn-IN",
    TA: "ta-IN",
    TE: "te-IN",
    ML: "ml-IN",
    MR: "mr-IN",
    BN: "bn-IN",
    GU: "gu-IN",
    PA: "pa-IN",
    OR: "or-IN",
};
// ─── Emergency Keywords (Multi-language) ─────────────────────────────────────
const EMERGENCY_KEYWORDS = [
    // ── English ────────────────────────────────────────────────
    "chest pain",
    "pain in chest",
    "heart attack",
    "can't breathe",
    "cant breathe",
    "not breathing",
    "breathing difficulty",
    "unconscious",
    "unconsciousness",
    "stroke",
    "stroke symptoms",
    "heavy bleeding",
    "collapsed",
    "seizure",
    "choking",
    "fainted",
    "cardiac arrest",
    "no pulse",
    "head injury",
    "severe bleeding",
    "drowning",
    "poisoning",
    "overdose",
    "electric shock",
    "severe burn",
    "severe injury",
    "allergic reaction",
    "anaphylaxis",
    "emergency",
    // ── Hindi (हिंदी) ───────────────────────────────────────
    "seene mein dard",
    "saans nahi",
    "behosh",
    "sar mein chot",
    "bhari khun",
    "dil ka dora",
    "stroke",
    "maarna",
    "sharir mein julm",
    "sakht chot",
    "jehrili khana",
    "jala hai",
    "ghutna",
    "nadi kat gyi",
    "tez rakt bah",
    "sankat",
    "aapat",
    "achal halat",
    "तुरंत",
    "जरूरी",
    // ── Kannada (ಕನ್ನಡ) ────────────────────────────────────────
    "ಎದೆ ನೋವು",
    "ಉಸಿರಾಟ ಆಗುತ್ತಿಲ್ಲ",
    "ತೀವ್ರ ರಕ್ತಸ್ರಾವ",
    "channagilla",
    "ulbana",
    "mugisu",
    "hridaya ghat",
    "swaasa rigal",
    "belagina heddu",
    "shirasu chot",
    "rakt lagge",
    "mota vega",
    "hachchu",
    "jvalana",
    "saktha chot",
    "sharirada mushti",
    "mrutyu",
    "anichanatone",
    "sankat",
    "ತುರ್ತ",
    "ಅಪಾಯ",
    // ── Telugu (తెలుగు) ────────────────────────────────────────
    "gunde noppi",
    "hrudaya ghatam",
    "saasam ledu",
    "saasam kashtam",
    "behosh",
    "telivi ledu",
    "stroke",
    "fit vachindi",
    "raktham ekkuva",
    "blood ekkuva pothundi",
    "accident ayyindi",
    "visham thagadu",
    "sankat",
    "turnt",
    // ── Tamil (தமிழ்) ───────────────────────────────────────────
    "kattai vali",
    "swaasam illa",
    "samayam illai",
    "akattamai",
    "kai kattu",
    "kutti vai",
    "thalai vali",
    "rakattaam",
    "bayam",
    "kaatai vali",
    "maram vali",
    "sankat",
    "thuraiyai",
    "apayadai",
    // ── Malayalam (മലയാളം) ────────────────────────────────────
    "pulppili",
    "thwaasam illa",
    "samayam illa",
    "unnattam illa",
    "kattu",
    "thalakk vali",
    "rakta pravaha",
    "bayam",
    "maranasamshayam",
    "sankat",
    // ── Marathi (मराठी) ────────────────────────────────────────
    "hriday dard",
    "swaas nahi",
    "behosh",
    "sar mein takla",
    "khun bahat",
    "shatak chot",
    "marannache bhay",
    "gulte",
    "jvala",
    "takla",
    "sankat",
    // ── Bengali (বাংলা) ────────────────────────────────────────
    "buk dard",
    "shas nai",
    "hoosh nai",
    "sar katiye galo",
    "khun beye ache",
    "maran bhay",
    "bhayanok",
    "dag lag",
    "pran sankat",
    "sakta dukh",
    // ── Gujarati (ગુજરાતી) ──────────────────────────────────────
    "chati mein dard",
    "spaas nahi",
    "maran bhay",
    "sar ma chot",
    "khun vakre",
    "shareer ma dard",
    "sakhat chot",
    "khatarnak halat",
    "pran sankat",
    // ── Punjabi (ਪੰਜਾਬੀ) ────────────────────────────────────────
    "chhati vich dard",
    "svaas nahi",
    "sadhi hoosh",
    "ser vich chot",
    "khoon",
    "sankat",
    "maran bhay",
    "tez dard",
    "sharir vich jhalp",
    "khatarnak",
    // ── Odia (ଓଡିଆ) ──────────────────────────────────────────
    "buk dard",
    "santi nahi",
    "hosh nahi",
    "sir chot",
    "rakt anya",
    "maran bhay",
    "anik halat",
    "daha lag",
    "jibi sankat",
    "sakta veda",
];
// ─── Unicode Range Detection (MOST RELIABLE) ─────────────────────────────────
function detectByUnicodeRange(text) {
    if (!text?.trim())
        return null;
    // Count script characters per language to handle mixed/overlapping ranges
    const teCount = (text.match(/[\u0C00-\u0C7F]/g) || []).length;
    const knCount = (text.match(/[\u0C80-\u0CFF]/g) || []).length;
    // Telugu vs Kannada disambiguation (ranges are adjacent — need majority vote)
    if (teCount > 0 || knCount > 0) {
        return teCount >= knCount ? SupportedLanguage.TE : SupportedLanguage.KN;
    }
    // Bengali (বাংলা): U+0980-U+09FF
    if (/[\u0980-\u09FF]/.test(text))
        return SupportedLanguage.BN;
    // Devanagari (हिंदी, मराठी): U+0900-U+097F
    if (/[\u0900-\u097F]/.test(text)) {
        const lower = text.toLowerCase();
        if (/\b(aahe|ahem|hote|kami|tumar|marathi|mala|mi)\b/.test(lower)) {
            return SupportedLanguage.MR;
        }
        return SupportedLanguage.HI;
    }
    // Tamil (தமிழ்): U+0B80-U+0BFF
    if (/[\u0B80-\u0BFF]/.test(text))
        return SupportedLanguage.TA;
    // Malayalam (മലയാളം): U+0D00-U+0D7F
    if (/[\u0D00-\u0D7F]/.test(text))
        return SupportedLanguage.ML;
    // Gujarati (ગુજરાતી): U+0A80-U+0AFF
    if (/[\u0A80-\u0AFF]/.test(text))
        return SupportedLanguage.GU;
    // Punjabi (ਪੰਜਾਬੀ): U+0A00-U+0A7F
    if (/[\u0A00-\u0A7F]/.test(text))
        return SupportedLanguage.PA;
    // Odia (ଓଡ଼ିଆ): U+0B00-U+0B7F
    if (/[\u0B00-\u0B7F]/.test(text))
        return SupportedLanguage.OR;
    return null;
}
// ─── Keyword-Based Detection ──────────────────────────────────────────────────
function detectByKeywords(text) {
    if (!text?.trim())
        return null;
    const lower = text.toLowerCase();
    // English — only clear English phrases (not loanwords mixed into Indian languages)
    // Avoid: doctor, appointment, yes, ok — commonly used in Kannada/Hindi code-mix
    if (/\b(hello|good morning|good afternoon|good evening|how are you|thank you|thanks|goodbye|bye bye|speak english|in english|english please)\b/.test(lower)) {
        return SupportedLanguage.EN;
    }
    // Hindi keywords (removed 'hai', 'nahi', 'kya', 'aap' if they cause false positives, keeping strong ones)
    if (/\b(mujhe|kaise|hindi|namaste|bolte|hain|hoon|raha|rahe|aahe|kahan|kaun|samajh|seekh|uthao)\b/.test(lower)) {
        return SupportedLanguage.HI;
    }
    // Marathi keywords
    if (/\b(mala|mi|kami|tumar|marathi|namskar|aalakh|bolto|hote|aahe|ahem|madhe)\b/.test(lower)) {
        return SupportedLanguage.MR;
    }
    // Telugu keywords
    if (/\b(nenu|naaku|naku|meeru|avunu|kavali|cheppandi|telugu|ekkada)\b/.test(lower)) {
        return SupportedLanguage.TE;
    }
    // Tamil keywords
    if (/\b(naan|enna|eppadi|vendum|tamil|vanakkam|intha|sollran|sollnungal)\b/.test(lower)) {
        return SupportedLanguage.TA;
    }
    // Malayalam keywords
    if (/\b(njan|ente|ningal|malayalam|samsarikku|namaskaram|aarum|kooduthal)\b/.test(lower)) {
        return SupportedLanguage.ML;
    }
    // Bengali keywords
    if (/\b(ami|amar|aapne|bengali|nomoshkar|tomar|kothay)\b/.test(lower)) {
        return SupportedLanguage.BN;
    }
    // Gujarati keywords
    if (/\b(mane|tame|shu|gujarati|namaste|kem|cho)\b/.test(lower)) {
        return SupportedLanguage.GU;
    }
    // Punjabi keywords
    if (/\b(menu|tussi|punjabi|sat|sri|akal|bolde|kivein)\b/.test(lower)) {
        return SupportedLanguage.PA;
    }
    // Odia keywords
    if (/\b(ami|kichi|odia|namaskar|kemiti|achanti)\b/.test(lower)) {
        return SupportedLanguage.OR;
    }
    return null;
}
// ─── Check if text contains emergency keywords ──────────────────────────────
export function isEmergency(text) {
    if (!text?.trim())
        return false;
    const lower = text.toLowerCase();
    return EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw));
}
// ─── Main Language Detection Function ─────────────────────────────────────────
export function detectLanguage(config) {
    const { text, storedLanguage, defaultLanguage, confidence: minConfidence = 0.7 } = config;
    if (!text?.trim()) {
        return {
            language: storedLanguage || defaultLanguage || SupportedLanguage.EN,
            confidence: 0,
            detectionMethod: "fallback",
            isStrong: false,
        };
    }
    // Step 1: Unicode range detection (MOST RELIABLE)
    const unicodeLang = detectByUnicodeRange(text);
    if (unicodeLang) {
        return {
            language: unicodeLang,
            confidence: 0.95,
            detectionMethod: "unicode",
            isStrong: true,
        };
    }
    // Step 2: Keyword-based detection
    const keywordLang = detectByKeywords(text);
    if (keywordLang) {
        // English detection is very confident if we found strong keywords
        const confidence = keywordLang === SupportedLanguage.EN ? 0.9 : 0.8;
        return {
            language: keywordLang,
            confidence,
            detectionMethod: "keyword",
            isStrong: confidence >= minConfidence,
        };
    }
    // Step 3: Fallback to stored or default language
    return {
        language: storedLanguage || defaultLanguage || SupportedLanguage.EN,
        confidence: 0.5,
        detectionMethod: "fallback",
        isStrong: false,
    };
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getSarvamVoiceId(language) {
    // Sarvam female speaker "anushka" supports all Indian languages
    // Use "arjun" (male) for languages with limited female support
    const speakerMap = {
        "en-IN": "ritu",
        "hi-IN": "roopa",
        "kn-IN": "kavya",
        "ta-IN": "priya",
        "te-IN": "priya",
        "ml-IN": "priya",
        "mr-IN": "roopa",
        "bn-IN": "priya",
        "gu-IN": "priya",
        "pa-IN": "rahul",
        "or-IN": "rahul",
    };
    const speaker = speakerMap[language] ?? "ritu";
    return `${language}-${speaker}Neural`; // e.g. "kn-IN-anushkaNnural"
    // SarvamLiveTTS extracts parts[0]-parts[1] as language_code and maps speaker
}
export function getDeepgramLanguage(language) {
    const langMap = {
        "en-IN": "en",
        "hi-IN": "hi",
        "kn-IN": "kn",
        "ta-IN": "ta",
        "te-IN": "te",
        "ml-IN": "ml",
        "mr-IN": "mr",
        "bn-IN": "bn",
        "gu-IN": "gu",
        "pa-IN": "pa",
        "or-IN": "or",
    };
    console.log("[DG MAP ACTIVE]", language, "=>", langMap[language]);
    return langMap[language] || "en";
}
/** Filter coughs, filler sounds, and low-confidence noise before LLM */
export function isNoiseUtterance(transcript, confidence) {
    const t = transcript.trim();
    if (!t || t.length < 2)
        return true;
    const lower = t.toLowerCase().replace(/[.!?,]/g, "");
    // Filler sounds and backchannels
    if (/^(hmm|uh|um|ah|oh|hm|mhm|uhh|umm|huh|eh|aah)+$/i.test(lower))
        return true;
    // Very short low-confidence utterances (likely background noise)
    if (confidence !== undefined && confidence < 0.6 && t.split(/\s+/).length <= 2) {
        return true;
    }
    return false;
}
export function getLanguageName(language) {
    const names = {
        "en-IN": "English",
        "hi-IN": "Hindi",
        "kn-IN": "Kannada",
        "ta-IN": "Tamil",
        "te-IN": "Telugu",
        "ml-IN": "Malayalam",
        "mr-IN": "Marathi",
        "bn-IN": "Bengali",
        "gu-IN": "Gujarati",
        "pa-IN": "Punjabi",
        "or-IN": "Odia",
    };
    return names[language] || "Unknown";
}
export const SUPPORTED_LANGUAGES = [
    SupportedLanguage.EN,
    SupportedLanguage.HI,
    SupportedLanguage.KN,
    SupportedLanguage.TA,
    SupportedLanguage.TE,
    SupportedLanguage.ML,
    SupportedLanguage.MR,
    SupportedLanguage.BN,
    SupportedLanguage.GU,
    SupportedLanguage.PA,
    SupportedLanguage.OR,
];
