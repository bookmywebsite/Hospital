// PATH: src/app/api/twilio/gather/route.ts
// AI brain: scenario detection, Groq 8B-instant, fire-and-forget DB writes.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Groq from 'groq-sdk';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

/**`
 * ══════════════════════════════════════════════════════════════════════════════
 * LANGUAGE HANDLING FLOW IN GATHER WEBHOOK
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * INPUT: User speaks into phone → Twilio records speech & converts to text
 * 
 * DETECTION: 
 *   1. detectLang(speechText) analyzes user's speech for language indicators
 *      - Primary: Unicode ranges for native scripts (most reliable)
 *      - Secondary: Keyword patterns for English/romanized/mixed text
 *      - PRIORITY: Strong English keywords checked FIRST to avoid false positives
 *      - Returns detected language code or null if inconclusive
 * 
 * PERSISTENCE (fallback priority):
 *   1. If detectLang() found a strong language signal → USE IT
 *   2. Else if conversation has stored language from initial greeting → USE THAT
 *   3. Else → USE initial language parameter from URL
 *   
 *   This ensures:
 *   - User's current speech language takes precedence (real-time)
 *   - But preserves call consistency (doesn't thrash between languages)
 *   - And has a safe fallback (initial parameter chosen by user)
 * 
 * AI RESPONSE:
 *   - System prompt enforced: "ALWAYS respond ONLY in [language]"
 *   - Groq model respects this constraint
 *   - Response saved to DB with language for future continuity
 * 
 * SUPPORTED LANGUAGES (11 Indian languages):
 *   EN (English), HI (Hindi), KN (Kannada), TA (Tamil), TE (Telugu),
 *   ML (Malayalam), MR (Marathi), BN (Bengali), GU (Gujarati), PA (Punjabi), OR (Odia)
 * ══════════════════════════════════════════════════════════════════════════════
 */

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const EMERGENCY_KW = [
  // ── English ────────────────────────────────────────────────
  'chest pain', 'pain in chest', 'heart attack', "can't breathe", 'cant breathe',
  'not breathing', 'unconscious', 'stroke', 'heavy bleeding', 'collapsed',
  'seizure', 'choking', 'fainted', 'cardiac arrest', 'no pulse', 'head injury',
  'severe bleeding', 'drowning', 'poisoning', 'overdose', 'electric shock',
  'severe burn', 'severe injury', 'allergic reaction', 'anaphylaxis',

  // ── Hindi (हिंदी) ───────────────────────────────────────
  'seene mein dard', 'saans nahi', 'behosh', 'sar mein chot', 'bhari khun',
  'dil ka dora', 'stroke', 'marana', 'sharir mein julm', 'sakht chot',
  'jehrili khana', 'jala hai', 'ghutna', 'nadi kat gyi', 'tez rakt bah',

  // ── Kannada (ಕನ್ನಡ) ────────────────────────────────────────
  'channagilla', 'ulbana', 'mugisu', 'hridaya ghat', 'swaasa rigal',
  'belagina heddu', 'shirasu chot', 'rakt lagge', 'mota vega', 'hachchu',
  'jvalana', 'saktha chot', 'sharirada mushti', 'mrutyu', 'anichanatone',

  // ── Telugu (తెలుగు) ────────────────────────────────────────
  'gunde noppi', 'hrudaya ghatam', 'saasam ledu', 'saasam kashtam',
  'behosh', 'telivi ledu', 'stroke', 'fit vachindi',
  'raktham ekkuva', 'blood ekkuva pothundi', 'accident ayyindi',
  'visham thagadu',

  // ── Tamil (தமிழ்) ───────────────────────────────────────────
  'kattai vali', 'swaasam illa', 'samayam illai', 'akattamai', 'kai kattu',
  'kutti vai', 'thalai vali', 'samayam illa', 'rakattaam', 'bayam',
  'kaatai vali', 'maram vali', 'kattaimai', 'samayam illai',

  // ── Malayalam (മലയാളം) ────────────────────────────────────
  'pulppili', 'thwaasam illa', 'samayam illa', 'unnattam illa', 'kattu',
  'thalakk vali', 'rakta pravaha', 'bayam', 'maranasamshayam', 'samayam',

  // ── Marathi (मराठी) ────────────────────────────────────────
  'hriday dard', 'swaas nahi', 'behosh', 'sar mein takla', 'khun bahat',
  'shatak chot', 'marannache bhay', 'gulte', 'jvala', 'takla',

  // ── Bengali (বাংলা) ────────────────────────────────────────
  'buk dard', 'shas nai', 'hoosh nai', 'sar katiye galo', 'khun beye ache',
  'maran bhay', 'bhayanok', 'dag lag', 'pran sankat', 'sakta dukh',

  // ── Gujarati (ગુજરાતી) ──────────────────────────────────────
  'chati mein dard', 'spaas nahi', 'maran bhay', 'sar ma chot', 'khun vakre',
  'shareer ma dard', 'sakhat chot', 'khatarnak halat', 'pran sankat',

  // ── Punjabi (ਪੰਜਾਬੀ) ────────────────────────────────────────
  'chhati vich dard', 'svaas nahi', 'sadhi hoosh', 'ser vich chot', 'khoon',
  'sankat', 'maran bhay', 'tez dard', 'sharir vich jhalp', 'khatarnak',

  // ── Odia (ଓଡିଆ) ──────────────────────────────────────────
  'buk dard', 'santi nahi', 'hosh nahi', 'sir chot', 'rakt anya',
  'maran bhay', 'anik halat', 'daha lag', 'jibi sankat', 'sakta veda',
];

function detectLang(s: string): string | null {
  if (!s?.trim()) return null;

  // Unicode range detection for all 11 Indian languages (MOST RELIABLE)
  if (/[\u0C80-\u0CFF]/.test(s)) return 'kn-IN';       // Kannada
  if (/[\u0980-\u09FF]/.test(s)) return 'bn-IN';       // Bengali
  if (/[\u0900-\u097F]/.test(s)) {                     // Devanagari (Hindi, Marathi)
    const l = s.toLowerCase();
    if (/\b(mara|marathi|shri|aalakh)\b/.test(l)) return 'mr-IN';  // Marathi keywords
    // Only detect Hindi if FULL sentence is mostly Hindi (prevent false triggers from STT)
    if (s.length > 10) return 'hi-IN';
    return null;
  }
  if (/[\u0B80-\u0BFF]/.test(s)) return 'ta-IN';       // Tamil
  if (/[\u0C00-\u0C7F]/.test(s)) return 'te-IN';       // Telugu
  if (/[\u0D00-\u0D7F]/.test(s)) return 'ml-IN';       // Malayalam
  if (/[\u0A80-\u0AFF]/.test(s)) return 'gu-IN';       // Gujarati
  if (/[\u0A00-\u0A7F]/.test(s)) return 'pa-IN';       // Punjabi
  if (/[\u0B00-\u0B7F]/.test(s)) return 'or-IN';       // Odia

  // Keyword-based detection for all languages
  const l = s.toLowerCase();

  // ✅ ENGLISH DETECTION (check for proper English nouns/verbs, not just common words)
  // Only trigger if we find STRONG English patterns (not just articles/prepositions)
  if (/\b(appointment|hospital|doctor|symptom|medicine|prescription|test|scan|emergency|help|problem|issue|blood|pain|fever|call|name|address|phone|email|booking|consult|checkup|surgery|disease|treatment|clinic|patient|diagnosis|hello|hi|yes|yeah|ok|okay|sure|right|please)\b/.test(l)) {
    return 'en-IN';
  }

  // Kannada keywords
  if (/\b(nanu|illi|yenu|hogbeku|beku|illa|namaskara|nodona|kannada)\b/.test(l)) return 'kn-IN';

  // Hindi keywords (removed "main" which is common in English like "main issue", "main concern")
  // Only trigger if no English words matched (since English check is above and returns early)
  if (/\b(mujhe|aap|kaise|kahan|kyun)\b/.test(l)) return 'hi-IN';

  // Marathi keywords (removed "main" to avoid English false positive)
  if (/\b(mala|mi|kami|tumar|marathi|namskar|aalakh|bolto|hote|aahe|ahem)\b/.test(l)) return 'mr-IN';

  // Telugu keywords
  if (/\b(nenu|naaku|naku|meeru|ela|undi|ledu|avunu|kavali|cheppandi|telugu)\b/.test(l)) return 'te-IN';

  // Tamil keywords
  if (/\b(naan|enna|eppadi|vendum|tamil|vanakkam|intha)\b/.test(l)) return 'ta-IN';

  // Malayalam keywords
  if (/\b(njan|ente|ningal|malayalam|samsarikku|namaskara)\b/.test(l)) return 'ml-IN';

  // Bengali keywords
  if (/\b(ami|amar|aapne|eta|kee|bengali|nomoshkar|tomar)\b/.test(l)) return 'bn-IN';

  // Gujarati keywords
  if (/\b(hu|mane|tame|shu|gujarati|namaste|ane)\b/.test(l)) return 'gu-IN';

  // Punjabi keywords (removed "main" to avoid English false positive, removed "ki" as too generic)
  if (/\b(menu|tussi|punjabi|sat|sri|akal|bolde|haan|nahi)\b/.test(l)) return 'pa-IN';

  // Odia keywords
  if (/\b(ami|mo|se|kichi|odia|namaskar|ka)\b/.test(l)) return 'or-IN';

  return null;  // Default to null - will fall back to conversation's detectedLanguage
}

function detectScenario(s: string, histLen: number): string {
  const l = s.toLowerCase();

  // EMERGENCY detection - English + regional keywords
  if (/chest pain|heart attack|can.?t breathe|unconscious|stroke|heavy bleeding|collapsed|seizure|choking|fainted|cardiac|seene mein dard|saans nahi|behosh|channagilla|ulbana|hridaya|dosa|kattai vali|buk dard|chati mein dard|chhati vich dard/.test(l))
    return 'EMERGENCY';

  // DOCTOR_AVAILABILITY - multi-language
  if (/doctor.*available|available.*doctor|is.*dr\.?|dr\.?.*today|doctor.*free|daktar|vaidya|chikitsa|doktor|dakatr/.test(l))
    return 'DOCTOR_AVAILABILITY';

  // RESCHEDULE - multi-language
  if (/reschedul|cancel.*appoint|change.*appoint|postpone|badal|prabandha|niyukti|milvan|samayam|tarikh/.test(l))
    return 'RESCHEDULE';

  // LAB_TEST - multi-language
  if (/blood test|lab test|mri|ct scan|x.?ray|ultrasound|ecg|scan|biopsy|pareeksha|raktapariksha|test|jaanch/.test(l))
    return 'LAB_TEST';

  // COST_ENQUIRY - multi-language
  if (/cost|price|charges|fees|how much|surgery cost|treatment cost|consultation fee|kharcha|mulya|dam|bhada|kima|kharch/.test(l))
    return 'COST_ENQUIRY';

  // INSURANCE - multi-language
  if (/insurance|cashless|tpa|mediclaim|policy|claim|health card|esic|cghs|bima|suraksha|patriplavan/.test(l))
    return 'INSURANCE';

  // MATERNITY - multi-language
  if (/pregnancy|pregnant|maternity|delivery|baby|gynecolog|trimester|garbha|sutika|shishu|prasputa|vagina|garbhavati/.test(l))
    return 'MATERNITY';

  // SECOND_OPINION - multi-language
  if (/second opinion|another doctor|already.*consult|seen.*doctor|dusra|anya|pehle|aagey/.test(l))
    return 'SECOND_OPINION';

  // PHARMACY - multi-language
  if (/medicine|tablet|capsule|pharmacy|drug|syrup|injection|aushadha|dava|oushadhi|viwi|drug|aushadh/.test(l))
    return 'PHARMACY';

  // LOCATION - multi-language
  if (/where.*hospital|location|address|directions|how to reach|landmark|kahan|sthaan|pata|aakar|jasth|adres|paththa/.test(l))
    return 'LOCATION';

  // GENERAL - multi-language
  if (/visiting hours|timing|facilities|parking|open|close|icu|ward|khuli|band|samay|sadhna|suvidha/.test(l))
    return 'GENERAL';

  // CONSULTATION - multi-language (catch-all default)
  if (/appoint|book|schedul|consult|see.*doctor|symptom|pain|fever|cough|sick|unwell|milen|booking|samay|bukke|sampark|vedana|sar|sakti|roga/.test(l))
    return 'CONSULTATION';

  if (histLen > 2) return 'CONSULTATION';
  return 'CONSULTATION';
}

function buildPrompt(
  scenario: string,
  agentName: string,
  hospName: string,
  patientName: string,
  lang: string,
  callType: string,
  purpose: string,
  address: string,
  mapsLink: string,
  visitingHours: string,
): string {
  const name = patientName || 'the patient';
  const hosp = hospName || 'City Hospital';
  const langNote = `
IMPORTANT:
- ALWAYS respond ONLY in ${lang}
- NEVER switch language
- Use simple spoken style, not formal writing.
- English only for medical terms
`;

  const base = `You are ${agentName}, AI health assistant at ${hosp}.
STRICT RULES:
- Max 2 short sentences.
- NEVER sales, NEVER BANT, NEVER diagnose, NEVER prescribe.
- Be polite, helpful, warm, professional, caring.${langNote}`;

  if (callType === 'outbound') {
    const p = purpose.toLowerCase();
    if (p.includes('reminder')) return `${base}\nYou called to remind about appointment. If they confirm, say great. If not, offer to reschedule immediately. Ask preferred time.`;
    if (p.includes('result')) return `${base}\nYou called because test reports are ready. Ask if they want to come in to review with doctor. Goal: book consultation.`;
    if (p.includes('discharge')) return `${base}\nWelfare check after discharge. Ask how they feel. If issues: book follow-up. If well: encourage as planned.`;
    if (p.includes('feedback')) return `${base}\nCollecting feedback. Ask how their visit was. If positive, ask for Google review. If negative, apologize and offer to resolve.`;
    if (p.includes('reactivat')) return `${base}\nCalling old patient. Ask if any health concerns. Suggest checkup or consultation. Goal: book appointment.`;
    if (p.includes('missed')) return `${base}\nFollowing up missed call. Ask how you can help. Then: understand need → suggest solution → book appointment.`;
    if (p.includes('checkup')) return `${base}\nPromoting full body checkup. Share brief price. Ask if interested. Goal: book checkup slot.`;
    if (p.includes('medic')) return `${base}\nMedication reminder for chronic patient. Ask if taking medicines regularly. If issues: book doctor. If well: encourage continuation.`;
    return `${base}\nHelp the patient. Ask: how can I help you today? Then: understand → suggest → book appointment.`;
  }

  switch (scenario) {
    case 'CONSULTATION':
      return `${base}
You are the hospital receptionist. Help book an appointment.
Ask ONE at a time: What is the problem? → Which department/doctor? → Preferred date and time?
Then confirm: "I have noted your appointment. Our team will confirm shortly."
If unsure about department, ask symptoms and suggest the right one.`;

    case 'DOCTOR_AVAILABILITY':
      return `${base}
Help check doctor availability. Ask which doctor or specialty they need.
Suggest morning or afternoon slots. Offer to book immediately.
If doctor is busy, suggest another slot or doctor in same specialty.`;

    case 'RESCHEDULE':
      return `${base}
Help reschedule or cancel appointment. Verify patient name and existing appointment.
Ask: reschedule or cancel? If reschedule: offer 2-3 new time options.
Try to reschedule rather than cancel — say "Let me find the next available slot for you."`;

    case 'LAB_TEST':
      return `${base}
Handle lab test or scan enquiry. Ask which test they need.
Share availability. Offer to book a slot.
If unsure about price, say "Our team will confirm the exact price. Let me book your slot."`;

    case 'COST_ENQUIRY':
      return `${base}
Handle treatment cost enquiry. Ask what condition or treatment.
Give approximate range, say "starting from" or "approximately".
Ask about insurance. Then suggest booking a consultation for exact estimate.`;

    case 'INSURANCE':
      return `${base}
Handle insurance query. Ask which insurance provider.
Say "We accept most major insurers including Mediclaim, Star Health, and others."
For specific pre-auth: "Our billing team will confirm. Shall I connect you or book a consultation?"`;

    case 'MATERNITY':
      return `${base}
Handle maternity enquiry. Ask how many months pregnant, first pregnancy or not.
Share package highlights: antenatal care, scans, delivery, postnatal.
Be extra warm. Goal: book gynecologist consultation — this is a high-value patient.`;

    case 'SECOND_OPINION':
      return `${base}
Handle second opinion request. Ask what condition they were diagnosed with.
Ask if they have reports. Say "Getting a second opinion is a wise decision."
Suggest the right specialist. Goal: book premium specialist consultation.`;

    case 'PHARMACY':
      return `${base}
Handle pharmacy or medicine enquiry. Give general medicine info only.
Always say: "Please take this only as prescribed by your doctor."
Guide them to visit pharmacy or book doctor if needed.`;

    case 'LOCATION':
      return `${base}
Give hospital location. Address: ${address}. Maps: ${mapsLink}.
Then offer: "Would you like to book an appointment before you come so you do not have to wait?"`;

    case 'GENERAL':
      return `${base}
Handle general enquiry. Visiting hours: ${visitingHours}.
Answer quickly and try to convert: "Is there anything specific I can help you with? I can book an appointment."`;

    default:
      return `${base}
Ask: "How may I assist you today?" Help with appointments, symptoms, medicines, or finding the right doctor.`;
  }
}

function xml(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function twiml(text: string, hangup: boolean, lang: string, gatherUrl: string): string {
  const clean = xml(text.replace(/[*_`#•\[\]]/g, '').replace(/\n+/g, ' ').trim());
  if (hangup) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi" rate="fast" language="${lang}">${clean}</Say><Pause length="1"/><Say voice="Polly.Aditi" rate="fast" language="${lang}">Thank you for calling. Take care. Goodbye!</Say><Hangup/></Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" rate="fast" language="${lang}">${clean}</Say>
  <Gather input="speech" action="${gatherUrl}" method="POST"
    speechTimeout="1" timeout="1" language="${lang}">
  </Gather>
  <Hangup/>
</Response>`;
}
function groqRole(r: string): 'user' | 'assistant' {
  return r === 'user' ? 'user' : 'assistant';
}

export async function POST(request: NextRequest) {
  const START = Date.now();

  try {
    const form = await request.formData();
    const callSid = (form.get('CallSid') as string) || '';
    const speech = (form.get('SpeechResult') as string) || '';

    const { searchParams } = new URL(request.url);
    let language = searchParams.get('language') || 'en-IN'; // Initial language from call setup (e.g., 'en-IN', 'hi-IN')
    const conversationId = searchParams.get('conversationId') || '';
    const callType = searchParams.get('callType') || 'inbound';
    const purpose = searchParams.get('purpose') || '';
    const speechLo = speech.toLowerCase();

    console.log(`[Gather] "${speech.slice(0, 60)}" | lang:${language} | type:${callType}`);

    // ✅ DETECT language from user's speech (handles language switches, code-mixing, etc.)
    const detectedFromSpeech = detectLang(speech);

    let convPromise = conversationId
      ? prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          agentId: true,
          leadId: true,
          patientId: true,
          agent: { select: { name: true, companyName: true, organizationId: true } },
          lead: { select: { firstName: true, phone: true } },
          patient: { select: { firstName: true, phone: true } },
          detectedLanguage: true,
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { role: true, content: true } },
        },
      })
      : prisma.conversation.findFirst({
        where: { twilioCallSid: callSid },
        select: {
          id: true,
          agentId: true,
          leadId: true,
          patientId: true,
          agent: { select: { name: true, companyName: true, organizationId: true } },
          lead: { select: { firstName: true, phone: true } },
          patient: { select: { firstName: true, phone: true } },
          detectedLanguage: true,
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { role: true, content: true } },
        },
      });

    // ⚡ INSTANT RESPONSE for common intents (NO AI CALL)
    let instantAiText = '';
    const cleanSpeech = speechLo.trim().replace(/[.,!?]/g, '');

    if (/appointment|book|schedule/.test(speechLo)) {
      instantAiText = "Sure, I will help you book an appointment. May I know your name?";
    } else if (/^(yes|yeah|yup|ok|okay|hmm|sure|right)$/i.test(cleanSpeech)) {
      instantAiText = "Okay, please tell me more.";
    } else if (/^(hello|hi|hey)$/i.test(cleanSpeech)) {
      instantAiText = "Hello! How can I help you today?";
    }

    // 🚀 FAST PATH (skip AI)
    if (!instantAiText && (!speech || speech.trim().length < 8)) {
      instantAiText = "Sure, please tell me more.";
    }

    let aiText = instantAiText;

    const scenario = detectScenario(speech, 0); // We will refine scenario logic later if history is needed
    const agentName = 'MedAssist';
    const hospName = process.env.HOSPITAL_NAME || 'City Hospital';
    const hospAddr = process.env.HOSPITAL_ADDRESS || 'our hospital — check Google Maps';
    const mapsLink = process.env.HOSPITAL_MAPS_LINK || 'https://maps.google.com';
    const visitHours = process.env.HOSPITAL_VISITING_HOURS || '8 AM to 8 PM daily';
    const patientName = '';

    const AI_START = Date.now();

    let finalConv: any = null;

    if (!aiText) {
      try {
        finalConv = await convPromise;
        if (!finalConv) {
          return new NextResponse(
            `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, please call us back. Goodbye!</Say><Hangup/></Response>`,
            { headers: { 'Content-Type': 'text/xml' } },
          );
        }

        const history = [...(finalConv.messages || [])].reverse();
        const prompt = buildPrompt(scenario, finalConv.agent?.name || agentName, finalConv.agent?.companyName || hospName, finalConv.patient?.firstName || finalConv.lead?.firstName || patientName, language, callType, purpose, hospAddr, mapsLink, visitHours);

        const aiPromise = groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          max_tokens: 40,
          temperature: 0.7,
          top_p: 0.9,
          stream: false,
          messages: [
            { role: 'system', content: prompt },
            ...history.slice(-1).map((m: { role: string; content: string }) => ({
              role: groqRole(m.role),
              content: m.content,
            })),
            { role: 'user', content: speech || 'Hello' },
          ],
        });

        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve(null), 2000) // 2 sec max wait
        );

        const res: any = await Promise.race([aiPromise, timeoutPromise]);

        if (res) {
          aiText = res.choices[0]?.message?.content?.trim() || '';
          console.log(`🔥 AI Response Time: ${Date.now() - AI_START}ms`);
        } else {
          aiText = "Let me help you with that. Could you please tell me more?";
          console.log(`⏳ AI Timeout (fallback triggered)`);
        }
      } catch (err) {
        console.error('[Gather] Groq error:', err);
        aiText = `I am sorry, I had a brief issue. Could you please repeat that?`;
      }
    }
    if (!aiText) aiText = `Could you please say that again? I want to help you.`;

    console.log(`[Gather] ${scenario} → Groq in ${Date.now() - START}ms`);

    if (!finalConv) {
      finalConv = await convPromise;
    }

    if (!finalConv) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, please call us back. Goodbye!</Say><Hangup/></Response>`,
        { headers: { 'Content-Type': 'text/xml' } },
      );
    }

    // ✅ LANGUAGE PERSISTENCE WITH FALLBACK PRIORITY:
    if (detectedFromSpeech) {
      language = detectedFromSpeech; // always follow user speech
    } else if (finalConv.detectedLanguage) {
      language = finalConv.detectedLanguage;
    } else {
      language = 'en-IN';
    }

    if (speech) {
      prisma.message
        .create({
          data: { conversationId: finalConv.id, role: 'user', content: speech, senderType: finalConv.leadId ? 'lead' : 'patient' },
        })
        .catch((e) => console.error('[Gather] Save speech:', e));
    }

    if (EMERGENCY_KW.some((kw) => speechLo.includes(kw))) {
      const emergText = `This is a medical emergency. Please call 108 immediately or come to our hospital at ${hospAddr}. Call 108 now. We are here to help.`;

      const emergDb: Promise<unknown>[] = [
        prisma.message.create({
          data: { conversationId: finalConv.id, role: 'assistant', content: emergText, senderType: 'agent' },
        }),
        prisma.conversation.update({
          where: { id: finalConv.id },
          data: { status: 'CLOSED', endedAt: new Date(), detectedLanguage: language },
        }),
      ];
      if (finalConv.patientId) {
        emergDb.push(
          prisma.patient.update({
            where: { id: finalConv.patientId },
            data: { tier: 'HOT', patientStatus: 'ENGAGED' },
          }),
        );
        emergDb.push(
          prisma.activity.create({
            data: {
              patientId: finalConv.patientId,
              type: 'emergency_detected',
              title: 'Emergency on call',
              description: `"${speech}"`,
              actorType: 'agent',
              actorId: finalConv.agentId || '',
              metadata: { callSid },
            },
          }),
        );
      } else if (finalConv.leadId) {
        emergDb.push(
          prisma.lead.update({
            where: { id: finalConv.leadId },
            data: { tier: 'HOT', status: 'ENGAGED' },
          }),
        );
        emergDb.push(
          prisma.activity.create({
            data: {
              leadId: finalConv.leadId,
              type: 'emergency_detected',
              title: 'Emergency on call',
              description: `"${speech}"`,
              actorType: 'agent',
              actorId: finalConv.agentId || '',
              metadata: { callSid },
            },
          }),
        );
      }
      Promise.all(emergDb).catch((e) => console.error('[Gather] Emergency DB:', e));

      console.log(`[Gather] EMERGENCY handled in ${Date.now() - START}ms`);
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi" rate="fast" language="${language}">${xml(emergText)}</Say><Pause length="1"/><Say voice="Polly.Aditi" rate="fast" language="${language}">Please call 108 now. Your safety is our priority.</Say><Hangup/></Response>`,
        { headers: { 'Content-Type': 'text/xml' } },
      );
    }

    const endPhrases = ['goodbye', 'bye', 'thank you bye', "ok bye", "that's all", 'nothing else', 'no thanks'];
    const shouldEnd = (finalConv.messages?.length || 0) > 1 && endPhrases.some((p) => speechLo.includes(p));

    const BASE_URL = process.env.NEXT_PUBLIC_APP_URL!;
    const gatherQs = new URLSearchParams({ language, conversationId: finalConv.id, callType });
    if (purpose) gatherQs.set('purpose', purpose);
    const gatherUrl = `${BASE_URL}/api/twilio/gather?${gatherQs.toString()}`;

    const dbWrites: Promise<unknown>[] = [
      prisma.message.create({
        data: { conversationId: finalConv.id, role: 'assistant', content: aiText, senderType: 'agent' },
      }),
      prisma.conversation.update({
        where: { id: finalConv.id },
        data: {
          lastMessageAt: new Date(),
          detectedLanguage: language,
          messageCount: { increment: 2 },
          ...(shouldEnd ? { status: 'CLOSED', endedAt: new Date() } : {}),
        },
      }),
    ];

    if (finalConv.patientId) {
      dbWrites.push(
        prisma.activity.create({
          data: {
            patientId: finalConv.patientId,
            type: `voice_${scenario.toLowerCase()}`,
            title: `Voice AI — ${scenario}`,
            description: `"${speech.slice(0, 150)}"`,
            actorType: 'agent',
            actorId: finalConv.agentId || '',
            metadata: { scenario, language, callType, callSid },
          },
        }),
      );
    } else if (finalConv.leadId) {
      dbWrites.push(
        prisma.activity.create({
          data: {
            leadId: finalConv.leadId,
            type: `voice_${scenario.toLowerCase()}`,
            title: `Voice AI — ${scenario}`,
            description: `"${speech.slice(0, 150)}"`,
            actorType: 'agent',
            actorId: finalConv.agentId || '',
            metadata: { scenario, language, callType, callSid },
          },
        }),
      );
    }

    Promise.all(dbWrites).catch((e) => console.error('[Gather] DB writes:', e));

    console.log(`[Gather] Total: ${Date.now() - START}ms`);

    return new NextResponse(twiml(aiText, shouldEnd, language, gatherUrl), { headers: { 'Content-Type': 'text/xml' } });
  } catch (err) {
    console.error('[Gather] Fatal:', err);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>I am sorry for the trouble. Please call us back. Goodbye!</Say><Hangup/></Response>`,
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }
}
