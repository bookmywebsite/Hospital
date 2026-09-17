import twilio from 'twilio';
import Groq from 'groq-sdk';
export const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
// ── Language map — Twilio language codes ──────────────────────────────────────
const TWILIO_LANG_MAP = {
    EN: 'en-IN', HI: 'hi-IN', KN: 'kn-IN', TA: 'ta-IN',
    TE: 'te-IN', ML: 'ml-IN', MR: 'mr-IN', BN: 'bn-IN',
    GU: 'gu-IN', PA: 'pa-IN', OR: 'or-IN',
};
// Polly voices that support Indian languages
const TWILIO_VOICE_MAP = {
    'en-IN': 'Polly.Aditi', 'hi-IN': 'Polly.Aditi',
    'kn-IN': 'Polly.Aditi', 'ta-IN': 'Polly.Aditi',
    'te-IN': 'Polly.Aditi', 'ml-IN': 'Polly.Aditi',
    'mr-IN': 'Polly.Aditi', 'bn-IN': 'Polly.Aditi',
    'gu-IN': 'Polly.Aditi', 'pa-IN': 'Polly.Aditi',
    'or-IN': 'Polly.Aditi',
};
// ── Emergency keywords ────────────────────────────────────────────────────────
const EMERGENCY_KEYWORDS = [
    'chest pain', 'heart attack', "can't breathe", 'cant breathe',
    'not breathing', 'breathing difficulty', 'unconscious', 'stroke',
    'heavy bleeding', 'collapsed', 'seizure', 'overdose', 'choking',
    'fainted', 'blackout', 'cardiac arrest', 'severe bleeding', 'no pulse',
    // Indian language variants
    'seene mein dard', 'saans nahi', 'behosh', 'bahut khoon',
    'nenu breathe chesuko lekapoyatam', 'usiru baralla', 'ede novu',
];
// ── Detect language from speech ───────────────────────────────────────────────
function detectLanguageFromSpeech(speech) {
    const s = speech;
    // First: Check for non-Latin scripts (Unicode ranges are most reliable)
    // Kannada Unicode range
    if (/[\u0C80-\u0CFF]/.test(s))
        return 'KN';
    // Hindi/Devanagari
    if (/[\u0900-\u097F]/.test(s))
        return 'HI';
    // Tamil
    if (/[\u0B80-\u0BFF]/.test(s))
        return 'TA';
    // Telugu
    if (/[\u0C00-\u0C7F]/.test(s))
        return 'TE';
    // Malayalam
    if (/[\u0D00-\u0D7F]/.test(s))
        return 'ML';
    // Bengali
    if (/[\u0980-\u09FF]/.test(s))
        return 'BN';
    // Gujarati
    if (/[\u0A80-\u0AFF]/.test(s))
        return 'GU';
    // Punjabi/Gurmukhi
    if (/[\u0A00-\u0A7F]/.test(s))
        return 'PA';
    // Second: Keyword-based detection for romanized text (word boundaries only)
    const lower = speech.toLowerCase();
    // ✅ English keywords first (strong conversational and medical terms)
    if (/\b(appointment|hospital|doctor|symptom|medicine|prescription|test|scan|emergency|help|problem|issue|blood|pain|fever|call|name|address|phone|email|booking|consult|checkup|surgery|disease|treatment|clinic|patient|diagnosis|hello|hi|yes|yeah|yep|ok|okay|sure|right|please|thanks|thank you|good|morning|afternoon|evening|bye|goodbye)\b/.test(lower)) {
        return 'EN';
    }
    // Kannada keywords (with word boundaries)
    if (/\b(nanu|illi|yenu|mane|hogbeku|beku|illa|kannada|namaskara|hogtha|aagbeku|nodona)\b/.test(lower))
        return 'KN';
    // Hindi keywords (with word boundaries) - MORE SPECIFIC
    if (/\b(mujhe|aapka|kaise|hindi|nahin|bilkul|theek|samajh)\b/.test(lower))
        return 'HI';
    // Tamil keywords (with word boundaries)
    if (/\b(naan|enna|eppadi|tamil|vanakkam|ungal|sollren)\b/.test(lower))
        return 'TA';
    // Telugu keywords (with word boundaries)
    if (/\b(nenu|meeru|telugu|emandi|ela|cheppandi|anthe)\b/.test(lower))
        return 'TE';
    // Malayalam keywords (with word boundaries)
    if (/\b(ente|ningal|malayalam|samsarikku|venda|ethra)\b/.test(lower))
        return 'ML';
    // Default to English if no language-specific patterns found
    return 'EN';
}
// ── Detect hospital sub-agent ─────────────────────────────────────────────────
function detectSubAgent(speech, historyLen) {
    const s = speech.toLowerCase();
    if (/appoint|book|schedul|cancel|reschedul|slot|timing|available|visit|opd|check.?up|consult|see.*doctor|meet.*doctor/.test(s))
        return 'RECEPTIONIST';
    if (/symptom|pain|fever|cough|cold|vomit|nausea|diarrhea|dizzy|headache|bleed|swell|rash|hurt|sick|unwell|not feel|weak|tired|burning|infection|wound|injury|breathless/.test(s))
        return 'TRIAGE';
    if (/medicine|tablet|capsule|drug|dose|dosage|side effect|prescription|paracetamol|aspirin|antibiotic|syrup|injection|what.*tablet|which.*medicine/.test(s))
        return 'PHARMACIST';
    if (/which doctor|which department|specialist|cardiolog|dermatolog|orthoped|gynecolog|neurolog|pediatric|general physician|ent|ophthalmol|urolog|gastro|pulmonolog/.test(s))
        return 'CONSULTANT';
    if (historyLen > 2)
        return 'TRIAGE';
    return 'RECEPTIONIST';
}
// ── Hospital system prompts ───────────────────────────────────────────────────
function buildHospitalPrompt(subAgent, agentName, hospitalName, patientName, detectedLang, hospitalAddress, hospitalPhone, hospitalEmail) {
    const patient = patientName || 'the patient';
    const hospital = hospitalName || 'City Hospital';
    const address = hospitalAddress || 'our hospital — please check Google Maps';
    const phone = hospitalPhone || 'our main reception';
    const email = hospitalEmail || 'our hospital email';
    const langInstruction = detectedLang !== 'EN'
        ? `\nCRITICAL: The patient is speaking in ${getLangName(detectedLang)}. You MUST respond ENTIRELY in ${getLangName(detectedLang)}. Do NOT respond in English. Use ${getLangName(detectedLang)} for the entire response. Only use English for specific medical terms that have no translation.`
        : `\nRespond in clear, simple Indian English.`;
    const core = `You are ${agentName}, an AI healthcare assistant at ${hospital}.
You are on a LIVE PHONE CALL with ${patient}.

HOSPITAL INFORMATION:
- Address: ${address}
- Phone: ${phone}
- Email: ${email}

Speak like a warm, caring Indian hospital staff member on a phone call.
STRICT RULES — NEVER BREAK THESE:
- Maximum 2 short sentences per response — this is a phone call
- NEVER mention budget, cost, sales, business, revenue, deals, or money
- NEVER ask BANT questions (Budget, Authority, Need, Timeline)
- NEVER act like a sales agent
- NEVER diagnose any condition
- NEVER prescribe any medicine
- No bullet points, no lists, no asterisks — plain speech only
- Always recommend consulting a doctor for medical decisions${langInstruction}`;
    switch (subAgent) {
        case 'RECEPTIONIST':
            return `${core}

You are the Hospital Receptionist. Help the patient book an appointment.
Ask ONE question at a time in this order:
1. Patient full name
2. Which department or doctor
3. Preferred date and time
Then confirm: "I have noted your appointment. Our team will confirm shortly."
If patient has symptoms, say: "Let me note your appointment first, the doctor will assess you during the visit."`;
        case 'TRIAGE':
            return `${core}

You are the Hospital Triage Nurse. Understand symptoms and guide the patient.
Ask ONE question at a time:
1. What symptoms are you experiencing?
2. How long have you had this?
3. Is it mild, moderate, or severe?
4. Any existing conditions like diabetes or blood pressure?
After understanding: offer to book appointment with the right department.
Never diagnose. Always end with offering a doctor appointment.`;
        case 'PHARMACIST':
            return `${core}

You are the Hospital Pharmacist. Provide general medicine information only.
Explain what a medicine is generally used for.
ALWAYS say: "Please take this only as prescribed by your doctor."
NEVER suggest doses. NEVER prescribe. One topic per response.`;
        case 'CONSULTANT':
            return `${core}

You are the Hospital Medical Consultant. Suggest the right department.
Heart/chest → Cardiology. Skin → Dermatology. Bones/joints → Orthopaedics.
Children → Paediatrics. Eyes → Ophthalmology. Ear/nose/throat → ENT.
Stomach → Gastroenterology. Brain/nerves → Neurology. Women's health → Gynaecology.
General illness → General Physician.
After suggesting: "Would you like me to book an appointment with that department?"`;
        default:
            return `${core}

Greet warmly and ask: "How may I assist you today?"
Help with appointments, symptoms, medicines, or finding the right doctor.`;
    }
}
function getLangName(code) {
    const names = {
        KN: 'Kannada', HI: 'Hindi', TA: 'Tamil', TE: 'Telugu',
        ML: 'Malayalam', MR: 'Marathi', BN: 'Bengali', GU: 'Gujarati',
        PA: 'Punjabi', EN: 'English',
    };
    return names[code] ?? 'English';
}
function xmlEsc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
// ── Outbound call ─────────────────────────────────────────────────────────────
export async function makeOutboundCall(options) {
    const base = process.env.VOICE_AI_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourdomain.com';
    const lang = options.language ?? 'EN';
    const call = await twilioClient.calls.create({
        to: options.to,
        from: process.env.TWILIO_PHONE_NUMBER,
        url: `${base}/api/twilio/voice?agentId=${options.agentId}&leadId=${options.leadId ?? ''}&orgId=${options.organizationId}&language=${lang}`,
        statusCallback: `${base}/api/twilio/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: true,
        recordingStatusCallback: `${base}/api/twilio/recording`,
    });
    return call.sid;
}
// ── Hospital greeting TwiML ───────────────────────────────────────────────────
export function generateGreetingTwiML(agentName, leadName, webhookBase, preferredLanguage = 'EN') {
    const base = webhookBase ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourdomain.com';
    const langCode = TWILIO_LANG_MAP[preferredLanguage] ?? 'en-IN';
    const voice = TWILIO_VOICE_MAP[langCode] ?? 'Polly.Aditi';
    const hospital = process.env.HOSPITAL_NAME ?? 'the hospital';
    const greeting = leadName
        ? `Hello ${leadName}! This is ${agentName} calling from ${hospital}. How are you feeling today? How can I help you?`
        : `Thank you for calling ${hospital}. This is ${agentName}, your AI health assistant. How may I help you today?`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${langCode}">${xmlEsc(greeting)}</Say>
  <Gather input="speech" action="${base}/api/twilio/gather" method="POST"
    speechtimeout="auto" speechModel="phone_call" enhanced="true" timeout="3"
    language="${langCode}">
    <Say voice="${voice}" language="${langCode}"> </Say>
  </Gather>
  <Say voice="${voice}" language="${langCode}">I am here to help. Please go ahead.</Say>
  <Gather input="speech" action="${base}/api/twilio/gather" method="POST"
    speechtimeout="auto" timeout="3" language="${langCode}">
    <Say voice="${voice}" language="${langCode}"> </Say>
  </Gather>
  <Hangup/>
</Response>`;
}
// ── Main AI voice response — HOSPITAL MODE ONLY ───────────────────────────────
export async function generateAIVoiceResponse(opts) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourdomain.com';
    const speechLower = opts.userSpeech.toLowerCase();
    // 1. Emergency check
    const isEmergency = EMERGENCY_KEYWORDS.some(kw => speechLower.includes(kw));
    if (isEmergency) {
        const txt = `This sounds like a medical emergency. Please call 108 immediately or go to the nearest emergency room right now. Please call 108 now.`;
        return {
            aiText: txt, shouldHangup: true,
            twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" rate="fast" language="en-IN">${xmlEsc(txt)}</Say>
  <Hangup/>
</Response>`,
        };
    }
    // 2. Detect language — from speech first, then fallback to lead preference
    const detectedLang = detectLanguageFromSpeech(opts.userSpeech) !== 'EN'
        ? detectLanguageFromSpeech(opts.userSpeech)
        : (opts.preferredLanguage ?? 'EN');
    const langCode = TWILIO_LANG_MAP[detectedLang] ?? 'en-IN';
    const voice = TWILIO_VOICE_MAP[langCode] ?? 'Polly.Aditi';
    // 3. Detect sub-agent
    const subAgent = detectSubAgent(opts.userSpeech, opts.callHistory.length);
    // 4. Build hospital prompt
    const systemPrompt = buildHospitalPrompt(subAgent, opts.agentName, process.env.HOSPITAL_NAME ?? opts.companyName ?? 'City Hospital', opts.leadName ?? '', detectedLang, process.env.HOSPITAL_ADDRESS, process.env.HOSPITAL_PHONE, process.env.HOSPITAL_EMAIL);
    // 5. Call Groq
    let aiText = '';
    try {
        const res = await groq.chat.completions.create({
            model: 'openai/gpt-oss-20b',
            max_tokens: 80,
            temperature: 0.65,
            messages: [
                { role: 'system', content: systemPrompt },
                ...opts.callHistory.slice(-6).map(m => ({
                    role: (m.role === 'user' ? 'user' : 'assistant'),
                    content: m.content,
                })),
                { role: 'user', content: opts.userSpeech },
            ],
        });
        aiText = res.choices[0]?.message?.content?.trim() ?? '';
    }
    catch (err) {
        console.error('[Hospital Voice] Groq error:', err);
        aiText = `I am sorry, I am having a little difficulty. Our team will assist you shortly.`;
    }
    if (!aiText)
        aiText = `Could you please repeat that? I want to make sure I help you correctly.`;
    // Clean for TwiML
    const cleanText = xmlEsc(aiText.replace(/[*_`#\-•]/g, '').replace(/\n+/g, ' ').trim());
    // 6. Detect hangup
    const endPhrases = ['bye', 'goodbye', 'thank you bye', "that's all", 'nothing else', 'ok bye', 'no thank you'];
    const shouldHangup = opts.callHistory.length > 2 && endPhrases.some(p => speechLower.includes(p));
    // 7. Build TwiML with detected language
    const twiml = shouldHangup
        ? `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${langCode}">${cleanText}</Say>
  <Pause length="1"/>
  <Say voice="${voice}" language="${langCode}">Thank you for calling. Please take care. Goodbye!</Say>
  <Hangup/>
</Response>`
        : `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${langCode}">${cleanText}</Say>
  <Gather input="speech" action="${base}/api/twilio/gather" method="POST"
    speechtimeout="auto" speechModel="phone_call" enhanced="true" timeout="3"
    language="${langCode}">
    <Say voice="${voice}" language="${langCode}"> </Say>
  </Gather>
  <Say voice="${voice}" language="${langCode}">I am still here. Please go ahead.</Say>
  <Gather input="speech" action="${base}/api/twilio/gather" method="POST"
    speechtimeout="auto" timeout="3" language="${langCode}">
    <Say voice="${voice}" language="${langCode}"> </Say>
  </Gather>
  <Hangup/>
</Response>`;
    return { twiml, shouldHangup, aiText };
}
// ── Format phone to E.164 ─────────────────────────────────────────────────────
export function formatPhoneE164(phone, defaultCountry = 'IN') {
    const digits = phone.replace(/\D/g, '');
    if (defaultCountry === 'IN') {
        if (digits.startsWith('91') && digits.length === 12)
            return `+${digits}`;
        if (digits.length === 10)
            return `+91${digits}`;
    }
    if (digits.length > 10)
        return `+${digits}`;
    return `+${digits}`;
}
// ── Send WhatsApp message ──────────────────────────────────────────────────────
export async function sendWhatsAppMessage(phoneNumber, message) {
    try {
        const formattedPhone = formatPhoneE164(phoneNumber);
        const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
        const fromNumber = twilioWhatsAppNumber.startsWith('whatsapp:') ? twilioWhatsAppNumber : `whatsapp:${twilioWhatsAppNumber}`;
        console.log('[WhatsApp Sending]', {
            from: fromNumber,
            to: `whatsapp:${formattedPhone}`,
            messageLength: message.length
        });
        const result = await twilioClient.messages.create({
            body: message,
            from: fromNumber,
            to: `whatsapp:${formattedPhone}`,
        });
        // Twilio returns "queued" immediately after accepting a message.
        // Delivery updates happen asynchronously later via status callbacks.
        console.log('[WhatsApp Accepted by Twilio]', { sid: result.sid });
        return { success: true, messageId: result.sid, providerStatus: result.status ?? 'queued' };
    }
    catch (error) {
        console.error('[WhatsApp Send Error]', { message: error.message, code: error.code, status: error.status });
        return { success: false, error: error.message || 'Failed to send WhatsApp message' };
    }
}
export async function verifyConnection() {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID || twilioClient.accountSid;
        const account = await twilioClient.api.accounts(accountSid).fetch();
        return { success: true, message: `Connected to Twilio account ${account.friendlyName || account.sid}` };
    }
    catch (error) {
        console.error('[Twilio Verify Connection Error]', { code: error.code, message: error.message });
        return { success: false, message: error.message || 'Failed to verify Twilio connection' };
    }
}
// ── Send SMS message ───────────────────────────────────────────────────────────
export async function sendSMSMessage(phoneNumber, message) {
    try {
        const formattedPhone = formatPhoneE164(phoneNumber);
        const result = await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER || '+15551234567',
            to: formattedPhone,
        });
        return { success: true, messageId: result.sid };
    }
    catch (error) {
        // Check if it's a trial account unverified number error (21608)
        const isTrialError = error.code === 21608 || error.message?.includes('unverified');
        console.error('[SMS Send Error]', { code: error.code, message: error.message, isTrialError });
        return {
            success: false,
            error: error.message || 'Failed to send SMS message',
            isTrialAccountError: isTrialError
        };
    }
}
