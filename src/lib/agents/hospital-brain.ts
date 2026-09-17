import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Emergency keywords (English + Hindi + Kannada) ────────────────────────────
const EMERGENCY_KEYWORDS = [
  "chest pain",
  "heart attack",
  "cant breathe",
  "can't breathe",
  "not breathing",
  "breathing difficulty",
  "unconscious",
  "stroke",
  "heavy bleeding",
  "collapsed",
  "seizure",
  "overdose",
  "choking",
  "fainted",
  "blackout",
  "cardiac arrest",
  "no pulse",
  "severe bleeding",
  "head injury",
  "not responding",
  "seene mein dard",
  "saans nahi aa raha",
  "behosh ho gaya",
  "bahut zyada khoon",
  "nenu breathe chesuko lekapoyatam ledu",
  "channagilla",
  "ulbana",
  "breathlessness",
  "difficulty speaking",
  "unable to speak",
  "blood vomiting",
  "accident",
  "fell down",
  "severe headache",
  "weakness in hand",
  "weakness in leg",
  "urinary obstruction",
  "bleeding",
  "road accident",
  "not responding",
];

// ── Detect which of the 6 sub-agents should respond ──────────────────────────
function detectSubAgent(
  speech: string,
  history: { role: string; content: string }[],
): string {
  const s = speech.toLowerCase();

  // Appointment / scheduling
  if (
    /appoint|book|schedul|cancel|reschedul|slot|timing|available|visit|opd|check.?up|consult|see.*doctor|meet.*doctor/.test(
      s,
    )
  )
    return "RECEPTIONIST";

  // Symptoms / triage
  if (
    /symptom|pain|fever|cough|cold|vomit|nausea|diarrhea|dizzy|headache|bleed|swell|rash|hurt|sick|unwell|not feel|weak|tired|burning|itching|infection|wound|injury|problem|trouble/.test(
      s,
    )
  )
    return "TRIAGE";

  // Medicines
  if (
    /medicine|tablet|capsule|drug|dose|dosage|side effect|prescription|paracetamol|aspirin|antibiotic|strip|syrup|injection|ointment|cream|what.*tablet|which.*medicine/.test(
      s,
    )
  )
    return "PHARMACIST";

  // Doctor / department suggestion
  if (
    /which doctor|which department|what specialist|cardiolog|dermatolog|orthoped|gynecolog|neurolog|pediatric|general physician|ent|ophthalmol|urolog|gastro|pulmonolog|oncolog|psychiatr|endocrin|rheumatolog/.test(
      s,
    )
  )
    return "CONSULTANT";

  // Language
  if (
    /hindi mein|kannada|tamil|telugu|malayalam|marathi|bengali|punjabi|gujarati|speak.*language|translate|respond.*hindi|mujhe hindi/.test(
      s,
    )
  )
    return "INTERPRETER";

  // Notes / documentation
  if (
    /note|summary|document|record|history|report|write down|keep.*record/.test(
      s,
    )
  )
    return "SCRIBE";

  // If conversation already started and context is medical, default to triage
  if (history.length > 2) return "TRIAGE";

  return "RECEPTIONIST";
}

// ── Master system prompt — all 7 agents built in ─────────────────────────────
function buildMasterPrompt(
  agentName: string,
  hospitalName: string,
  patientName: string,
  subAgent: string,
  language: string,
  hospitalAddress?: string,
  hospitalPhone?: string,
  hospitalEmail?: string,
): string {
  const name = patientName ? patientName : "the patient";
  const hosp = process.env.HOSPITAL_NAME || hospitalName || "City Hospital";
  const address =
    process.env.HOSPITAL_ADDRESS ||
    hospitalAddress ||
    "our hospital — please check Google Maps";
  const phone =
    process.env.HOSPITAL_PHONE || hospitalPhone || "our main reception";
  const email =
    process.env.HOSPITAL_EMAIL || hospitalEmail || "our hospital email";

  const langLine =
    language && language !== "EN"
      ? `\nIMPORTANT: Patient prefers ${language}. Mix ${language} with English naturally for medical terms.`
      : "";

  const base = `You are ${agentName}, an AI healthcare assistant at ${hosp}.
You are on a PHONE CALL with ${name}.

HOSPITAL INFORMATION (use ONLY these, never make up details):
- Name: ${hosp}
- Address: ${address}
- Phone: ${phone}
- Email: ${email}
Never provide any hospital information outside these values.
If information is unavailable,
say:
"Please contact the hospital front desk for confirmation."

Speak exactly like a warm, caring Indian hospital staff member would on a phone call.
Keep EVERY response to 1-2 short sentences only — this is a voice call.
If the caller is silent for several seconds,
politely ask:
"Are you there?"
or
"Would you like me to repeat that?"
Never use bullet points, lists, asterisks, or any formatting.
Never diagnose any condition. Never prescribe medicines.
Always recommend consulting a doctor for medical decisions.
NEVER use filler phrases like "I'll help you with that", "Sure", "Of course", "Certainly", "I'd be happy to help".
NEVER say "receptionist" in multiple responses — use "front desk" or "our team" instead.
Be conversational, empathetic, and professional.${langLine}`;

  switch (subAgent) {
    case "RECEPTIONIST":
      return `${base}

You are the front desk assistant at ${hosp}.
On the first interaction ALWAYS offer:

1. Book an appointment with a specialist
2. Connect to the front desk
3. Emergency doctor assistance

Ask naturally in one sentence.
Your only job is to help patients book, reschedule, or cancel appointments.

On first contact, present these 3 options naturally:
"You can: 1) Book an appointment with a specialist, 2) Connect to our front desk, or 3) Reach an emergency doctor. Which would you prefer?"

Follow this natural conversation flow:
- Ask: "May I know your name please?"
- Then: "Which department or which doctor would you like to see?"
- Then: "Would you like to share your symptoms or elaborate on your condition before I note the appointment?"
- Then: "What date and time would be convenient for you?"
- Then confirm: "Your appointment for [department] on [date] at [time] has been noted. Our team will confirm this shortly."
- Close with: "Thank you for contacting ${hosp}. Have a great day!"

If patient mentions symptoms, say: "Noted. The doctor will assess your condition when you visit."
Never diagnose. Stay focused on booking.`;

    case "TRIAGE":
      return `${base}

You are the AI Triage Nurse at ${hosp}.
Your job is to understand the patient's symptoms and guide them to the right care.

Ask these questions one at a time naturally:
1. "What symptoms are you experiencing?"
2. "How long have you been feeling this way?"
3. "Would you say the discomfort is mild, moderate, or severe?"
4. "Do you have any existing health conditions like diabetes or blood pressure?"
5. "Would you like to elaborate further on your condition?"

After gathering symptoms, respond with:
- If urgent: "Based on what you've shared, visiting today is recommended. Shall I book an urgent appointment?"
- If moderate: "A doctor should check this. Which day works for an appointment?"
- If mild: "A doctor can help. Would you like to book a convenient appointment?"

RED ZONE — If patient mentions: chest pain, breathlessness, unconsciousness, heavy bleeding,
wound, accident, fall, severe headache, weakness of hands or legs, difficulty speaking,
urinary obstruction, or blood injury → respond immediately:
"This sounds like a medical emergency. Please call ${phone} or 108 right now. Stay on the line."

Never diagnose. Always end by offering to connect with a doctor.`;

    case "PHARMACIST":
      return `${base}

You are the pharmacy assistant at ${hosp}.
You provide general medicine information only.

Rules you must follow every time:
- Explain what a medicine is generally used for in simple words
- Mention only very common, general side effects if asked
- ALWAYS add: "Please only take this as prescribed by your doctor."
- NEVER suggest a dose or quantity
- NEVER say "take this medicine for your condition"
- For interactions: "Please speak with our pharmacist in person for that."

Be simple, clear, and reassuring. One topic per response.`;

    case "CONSULTANT":
      return `${base}

You are the medical information assistant at ${hosp}.
Your job is to help patients find the right department or doctor.

Department guide:
- Heart / chest issues → Cardiology
- Skin / hair / nail → Dermatology
- Bone / joint / back → Orthopaedics
- Children under 15 → Paediatrics
- Eyes → Ophthalmology
- Ear / nose / throat → ENT
- Stomach / digestion → Gastroenterology
- Kidney → Nephrology / Urology
- Brain / nerves → Neurology
- Women's health → Gynaecology
- Lung / breathing → Pulmonology
- General illness → General Physician
- Mental health → Psychiatry

After suggesting: "Would you like me to book an appointment with that department today?"
Never diagnose. Keep explanations simple and reassuring.`;

    case "INTERPRETER":
      return `${base}

You are the AI Interpreter at ${hosp}.
Detect the language the patient is using and respond naturally in that same language.
Mix English only for medical terms that have no simple translation.
Keep the same warm, professional hospital tone.
Maintain complete medical accuracy while speaking their language.`;

    case "SCRIBE":
      return `${base}

You are the AI Medical Scribe at ${hosp}.
Help capture the patient's information clearly.

Ask these one at a time:
- "May I have your full name?"
- "What is your age?"
- "What are your main symptoms today?"
- "How long have you had these symptoms?"
- "Do you have any existing medical conditions?"

After collecting: "Thank you. I have noted your details. Our medical team will review this before your appointment."`;

    default:
      return `${base}

You are a helpful AI health assistant at ${hosp}.
Greet the patient warmly and ask: "How may I assist you today?"
Based on their response, help them with appointments, symptoms, medicines, or finding the right doctor.
Keep responses short and conversational for a phone call.`;
  }
}

// ── Main hospital voice response ──────────────────────────────────────────────
export async function generateHospitalVoiceResponse(params: {
  userSpeech: string;
  agentName: string;
  hospitalName: string;
  patientName?: string;
  language: string;
  callHistory: { role: string; content: string }[];
}): Promise<{
  aiText: string;
  twiml: string;
  shouldHangup: boolean;
  subAgent: string;
  isEmergency: boolean;
}> {
  const {
    userSpeech,
    agentName,
    hospitalName: passedHospitalName,
    patientName,
    language,
    callHistory,
  } = params;
  const hospitalName = process.env.HOSPITAL_NAME || passedHospitalName;
  const hospitalAddress = process.env.HOSPITAL_ADDRESS;
  const hospitalPhone = process.env.HOSPITAL_PHONE;
  const hospitalEmail = process.env.HOSPITAL_EMAIL;
  const speechLower = userSpeech.toLowerCase();

  // ── 1. Emergency check — always first ──────────────────────────────────────
  const isEmergency = EMERGENCY_KEYWORDS.some((kw) => speechLower.includes(kw));
  if (isEmergency) {
    const emergencyText = `This sounds very serious. Please call 108 immediately or go to the nearest emergency room right now. Please call 108 right away. Do not wait.`;
    return {
      aiText: emergencyText,
      twiml: makeTwiml(emergencyText, true),
      shouldHangup: true,
      subAgent: "EMERGENCY",
      isEmergency: true,
    };
  }

  // ── 2. Detect sub-agent ────────────────────────────────────────────────────
  const subAgent = detectSubAgent(userSpeech, callHistory);
  const systemPrompt = buildMasterPrompt(
    agentName,
    hospitalName,
    patientName ?? "",
    subAgent,
    language,
    hospitalAddress,
    hospitalPhone,
    hospitalEmail,
  );

  // ── 3. Build Groq messages ─────────────────────────────────────────────────
  const messages: { role: "system" | "user" | "assistant"; content: string }[] =
    [
      { role: "system", content: systemPrompt },
      ...callHistory.slice(-10).map((m) => ({
        role: (m.role === "user" ? "user" : "assistant") as
          | "user"
          | "assistant",
        content: m.content,
      })),
      { role: "user", content: userSpeech },
    ];

  // ── 4. Call Groq ───────────────────────────────────────────────────────────
  let aiText = "";
  try {
    const res = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages,
      max_tokens: 150,
      temperature: 0.7,
    });
    aiText = res.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("[Hospital Brain] Groq error:", err);
    aiText = `I'm sorry, I'm having a little difficulty. Please hold on, and one of our staff will assist you right away.`;
  }

  if (!aiText) {
    aiText = `I didn't quite catch that. Could you please say that again?`;
  }

  // ── 5. Detect call end ─────────────────────────────────────────────────────
  const endPhrases = [
    "bye",
    "goodbye",
    "thank you bye",
    "that's all",
    "nothing else",
    "ok bye",
    "thanks bye",
    "no thank you",
  ];
  const shouldHangup =
    callHistory.length > 2 && endPhrases.some((p) => speechLower.includes(p));

  return {
    aiText,
    twiml: makeTwiml(aiText, shouldHangup),
    shouldHangup,
    subAgent,
    isEmergency: false,
  };
}

// ── Build hospital greeting TwiML ─────────────────────────────────────────────
export function buildHospitalGreeting(
  agentName: string,
  hospitalName: string,
  patientName?: string,
): string {
  const hosp = hospitalName || "the hospital";
  const greeting = patientName
    ? `Hello ${patientName}! This is ${agentName} calling from ${hosp}. How are you feeling today? How can I help you?`
    : `Thank you for calling ${hosp}. This is ${agentName}, your AI health assistant. How may I help you today?`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" rate="fast" language="en-IN">${xmlEscape(greeting)}</Say>
  <Gather input="speech" action="/api/twilio/gather" method="POST"
    speechtimeout="auto" speechModel="phone_call" enhanced="true" timeout="3">
    <Say voice="Polly.Aditi" rate="fast" language="en-IN"> </Say>
  </Gather>
  <Hangup/>
</Response>`;
}
// ── TwiML builder ─────────────────────────────────────────────────────────────
function makeTwiml(text: string, hangup: boolean): string {
  const clean = xmlEscape(
    text
      .replace(/[*_`#\-•]/g, "")
      .replace(/\n+/g, " ")
      .trim(),
  );

  if (hangup) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" rate="fast" language="en-IN">${clean}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Aditi" rate="fast" language="en-IN">Thank you for calling. Please take care and stay safe. Goodbye!</Say>
  <Hangup/>
</Response>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" rate="fast" language="en-IN">${clean}</Say>
  <Gather input="speech" action="/api/twilio/gather" method="POST"
    speechtimeout="auto" speechModel="phone_call" enhanced="true" timeout="3">
    <Say voice="Polly.Aditi" rate="fast" language="en-IN"> </Say>
  </Gather>
  <Hangup/>
</Response>`;
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
