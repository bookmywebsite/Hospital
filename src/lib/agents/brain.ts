import Groq from 'groq-sdk';
import type { AgentContext, AgentResponse, QuickAction } from '@/types';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Detect which hospital sub-agent ──────────────────────────────────────────
function detectSubAgent(message: string, history: { role: string; content: string }[]): string {
  const s = message.toLowerCase();
  
  // 1. Explicit keywords take priority
  if (/appoint|book|schedul|cancel|reschedul|slot|timing|available|visit|opd|check.?up|when.*doctor|see.*doctor/.test(s)) return 'RECEPTIONIST';
  if (/symptom|pain|fever|cough|cold|vomit|nausea|diarrhea|dizzy|headache|bleed|swell|rash|hurt|sick|unwell|not feel|weak|tired|burning|infection|breathless/.test(s)) return 'TRIAGE';
  if (/medicine|tablet|capsule|drug|dose|dosage|side effect|prescription|paracetamol|aspirin|antibiotic|syrup|injection/.test(s)) return 'PHARMACIST';
  if (/which doctor|which department|specialist|cardiolog|dermatolog|orthoped|gynecolog|neurolog|pediatric|general physician|ent|ophthalmol/.test(s)) return 'CONSULTANT';
  
  // 2. Contextual continuity: if we were just in an appointment flow
  const lastAssistantMsg = [...history].reverse().find(m => m.role === 'assistant')?.content.toLowerCase() || '';
  if (/date and time|which department|confirm.*appointment|preferred date/i.test(lastAssistantMsg)) {
    return 'RECEPTIONIST';
  }

  // 3. Default based on conversation length
  if (history.length > 2) return 'TRIAGE';
  return 'RECEPTIONIST';
}

// ── Emergency detection ───────────────────────────────────────────────────────
const EMERGENCY_KEYWORDS = [
  'chest pain', 'heart attack', "can't breathe", 'cant breathe', 'not breathing',
  'breathing difficulty', 'unconscious', 'stroke', 'heavy bleeding', 'collapsed',
  'seizure', 'overdose', 'choking', 'fainted', 'blackout', 'cardiac arrest',
];

function hasUserProvidedDateTime(message: string, history: { role: string; content: string }[]): boolean {
  const userText = [...history, { role: 'user', content: message }]
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ')
    .toLowerCase();

  const hasDate = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(userText)
    || /\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/.test(userText)
    || /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\b/i.test(userText);
  const hasTime = /\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/i.test(userText) || /\b\d{1,2}\s*(am|pm)\b/i.test(userText);

  return hasDate && hasTime;
}

function hasUserProvidedDepartment(message: string, history: { role: string; content: string }[]): boolean {
  const userText = [...history, { role: 'user', content: message }]
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ')
    .toLowerCase();

  return /(cardiology|cardio|dermatology|derma|orthopa|orthoped|ortho|paediatrics|pediatr|ophthalmology|ophthal|ent|gastroenterology|gastro|neurology|neuro|gynaecology|gynecol|pulmonology|pulmo|psychiatry|general physician|general medicine|general physician)/i.test(userText);
}

// ── Build hospital system prompt ──────────────────────────────────────────────
function buildSystemPrompt(
  agentName: string, hospitalName: string, subAgent: string,
  patientName: string, channel: string, hasPatientName: boolean,
  hospitalAddress?: string, hospitalPhone?: string, hospitalEmail?: string,
): string {
  const patient  = patientName || 'the patient';
  const hospital = hospitalName || process.env.HOSPITAL_NAME || 'City Hospital';
  const address  = hospitalAddress || process.env.HOSPITAL_ADDRESS || 'our hospital — please check Google Maps';
  const phone    = hospitalPhone || process.env.HOSPITAL_PHONE || 'our main reception';
  const email    = hospitalEmail || process.env.HOSPITAL_EMAIL || 'our hospital email';

  const core = `You are ${agentName}, an AI healthcare assistant at ${hospital}.
You are helping ${patient} via ${channel}.

HOSPITAL INFORMATION:
- Name: ${hospital}
- Address: ${address}
- Phone: ${phone}
- Email: ${email}

ABSOLUTE RULES — NEVER BREAK THESE:
- You are a HOSPITAL assistant ONLY — never a sales agent
- NEVER ask about budget, cost, project cost, revenue, or money
- NEVER use BANT (Budget, Authority, Need, Timeline) qualification
- NEVER pitch any product, service, or business deal
- NEVER say anything related to sales
- NEVER diagnose any medical condition
- NEVER prescribe medicines or dosages
- Keep every response to 2-3 sentences maximum
- Be warm, caring, and professional like real hospital staff
- Always recommend consulting a doctor for medical decisions
- Always recommend consulting a doctor for medical decisions
- NEVER use filler phrases like "I'll help you with that", "Sure, I can help with that", "Of course", "Certainly", "I'd be happy to help"
- NEVER repeat the word "receptionist" more than once per conversation
- When the user asks for hospital name, address, phone or email — always use the values from HOSPITAL INFORMATION above, never make them up
- After booking an appointment, always close with: "Thank you for contacting ${hospital}. Have a great day!"`;

  switch (subAgent) {
    case 'RECEPTIONIST':
      return `${core}

You are the front desk assistant at ${hospital}.
Your ONLY job is helping patients book, reschedule, or cancel appointments.
When a patient first contacts you, present these 3 options clearly:
1. Book an appointment with a specialist doctor
2. Connect to our front desk for appointment assistance
3. Connect to an emergency doctor


${hasPatientName
  ? `Patient name is already known as "${patientName}". NEVER ask their full name again unless they ask to change it.
Ask ONE question at a time in this order:
1. "Which department or doctor would you like to see?"
2. "Would you like to elaborate on your symptoms or condition before I note the appointment?"
3. "What date and time would be convenient for you?"
4. Ask explicit confirmation: "Please confirm: should I book this appointment for [department] on [date] at [time]?"
5. Only after user confirms, respond: "Your appointment for [department] on [date] at [time] has been noted. Our team will confirm this shortly. Thank you for contacting ${hospital}. Have a great day!"`  : `Ask ONE question at a time in this order:
1. "May I know your full name please?"
2. "Which department or doctor would you like to see?"
3. "Would you like to elaborate on your symptoms or condition before I note the appointment?"
4. "What date and time would be convenient for you?"
5. Ask explicit confirmation: ...
6. Only after user confirms, respond: "Your appointment... Thank you for contacting ${hospital}. Have a great day!"`}

If patient mentions symptoms, say: "Noted. The doctor will assess your condition when you visit."
Never ask about budget or any sales topic.`;

    case 'TRIAGE':
      return `${core}

You are the Hospital Triage Nurse at ${hospital}.
Understand symptoms and guide the patient to the right care.

Ask ONE question at a time:
1. "What symptoms are you experiencing?"
2. "How long have you had these symptoms?"
3. "Would you say the discomfort is mild, moderate, or severe?"
4. "Do you have any existing conditions like diabetes or blood pressure?"
5. "After gathering symptoms ask: "Would you like to elaborate further on your condition before I book an appointment?"

After understanding:
- Urgent → "I'd recommend visiting us today. Shall I help book an urgent appointment?"
- Moderate → "A doctor should check this. Which day works for an appointment?"
- Mild → "A doctor can help. Would you like to book an appointment?"

If emergency symptoms (chest pain, breathing difficulty, heavy bleeding) → respond: "This sounds serious. Please call 108 immediately or go to the nearest emergency room."`;

    case 'PHARMACIST':
      return `${core}

You are the Hospital Pharmacist at ${hospital}.
Provide general medicine information ONLY.
- Explain what a medicine is generally used for
- Mention only very common side effects if asked
- ALWAYS say: "Please take this only as prescribed by your doctor."
- NEVER suggest doses. NEVER tell patient to take any medicine.`;

    case 'CONSULTANT':
      return `${core}

You are the Hospital Medical Consultant at ${hospital}.
Help patients find the right department or doctor.

Heart/chest → Cardiology | Skin → Dermatology | Bones/joints → Orthopaedics
Children → Paediatrics | Eyes → Ophthalmology | Ear/nose/throat → ENT
Stomach → Gastroenterology | Brain/nerves → Neurology | Women's health → Gynaecology
Lungs → Pulmonology | General illness → General Physician | Mental health → Psychiatry

After suggesting: "Would you like me to book an appointment with that department today?"`;

    default:
      return `${core}

Greet warmly and ask: 
When a patient first contacts you, present these 3 options:
1. Book an appointment with a specialist doctor
2. Connect to our front desk for appointment assistance
3. Connect to an emergency doctor

Ask: "How may I assist you today?"
Help with appointments, symptoms, medicines, or finding the right doctor.
You represent ${hospital} — a caring, professional healthcare institution.`;
  }
}

// ── Main chat function ────────────────────────────────────────────────────────
export async function processAgentMessage(
  message: string,
  context: AgentContext,
): Promise<AgentResponse> {
  const { agent, lead, conversationHistory, channel } = context;

  const envHospitalName = process.env.HOSPITAL_NAME;
  const hospitalAddress = process.env.HOSPITAL_ADDRESS;
  const hospitalPhone   = process.env.HOSPITAL_PHONE;
  const hospitalEmail   = process.env.HOSPITAL_EMAIL;

  const agentAny     = agent as any;
  const hospitalName = envHospitalName ?? agentAny.companyName ?? agentAny.organization?.name ?? 'City Hospital';
  const patientName  = lead ? (lead.fullName ?? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`).trim() : '';
  const hasPatientName = patientName.length > 0;

  // Emergency check first
  const msgLower     = message.toLowerCase();
  const isEmergency  = EMERGENCY_KEYWORDS.some(kw => msgLower.includes(kw));
  const asksHuman = /connect to anyone|connect me|human|real agent|receptionist|call hospital|staff/.test(msgLower);

  const subAgent     = detectSubAgent(message, conversationHistory);
  const systemPrompt = buildSystemPrompt(
    agent.name, 
    hospitalName, 
    subAgent, 
    patientName, 
    channel, 
    hasPatientName,
    hospitalAddress,
    hospitalPhone,
    hospitalEmail
  );
  const userProvidedDateTime = hasUserProvidedDateTime(message, conversationHistory);

  // Build messages
  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...conversationHistory.slice(-10).map(m => ({
      role:    (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  // Call Groq
  let responseText = '';
  try {
    const res = await groq.chat.completions.create({
      model:       'openai/gpt-oss-20b',
      max_tokens:  300,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.filter(m => m.content && m.content.trim() !== ''),
      ],
    });
    responseText = res.choices[0]?.message?.content?.trim() ?? '';
  } catch (err: any) {
    console.error('[Brain] Groq error details:', {
      message: err.message,
      stack: err.stack,
      data: err.response?.data
    });
    responseText = `I'm here to help you. Could you please tell me how I can assist you today?`;
  }

  if (!responseText) {
    responseText = `I'm here to help. How may I assist you today?`;
  }

  // If user didn't share date + time, never allow the assistant to claim booking.
  if (!userProvidedDateTime) {
    const looksLikeBookingConfirmation =
      /(i('|’)ve booked|appointment booked|appointment confirmed|scheduled|confirmed|confirmation sent|you('|’)ll receive a call|booked|scheduled)/i.test(responseText);

    if (looksLikeBookingConfirmation) {
      responseText = `Sure. Please share your preferred date and time for the appointment (for example: tomorrow at 4:00 PM), and I will book it here itself.`;
    }

    // If department is already known but date/time is missing, ask for date/time next.
    if (subAgent === 'RECEPTIONIST' && hasUserProvidedDepartment(message, conversationHistory)) {
      responseText = `Great. What date and time would be convenient for your appointment? (for example: tomorrow at 4:00 PM).`;
    }
  }

  if (asksHuman) {
    const hospitalNameEnv = process.env.HOSPITAL_NAME || hospitalName;
    responseText = `Connecting you to our front desk at ${hospitalNameEnv} now. Please use the connect option below.`;
  }

  // Emergency override
  if (isEmergency) {
    responseText = `⚠️ This sounds like a medical emergency. Please call **108** immediately or go to the nearest emergency room right now. Do not wait.`;
  }

  // Build quick actions
  const quickActions: QuickAction[] = [];
  const leadUpdates: Record<string, unknown> = {};
  let shouldBookMeeting = false;
  let shouldEscalate    = false;

  if (isEmergency) {
    quickActions.push({ id: 'emergency', label: '🚨 Call Emergency: 108', action: 'emergency' } as any);
    leadUpdates.tier   = 'HOT';
    leadUpdates.status = 'ENGAGED';
  }

  if (userProvidedDateTime && responseText.toLowerCase().includes('appointment') && responseText.toLowerCase().includes('noted')) {
    shouldBookMeeting = true;
    leadUpdates.status = 'MEETING_SET';
    quickActions.push({ id: 'appointment', label: '📅 Confirm Appointment', action: 'book_appointment' } as any);
  }

  if (asksHuman || responseText.toLowerCase().includes('connect you') || responseText.toLowerCase().includes('transfer')) {
    shouldEscalate = true;
    quickActions.push({ id: 'escalate', label: '👤 Connect to Hospital Staff', action: 'escalate' } as any);
  }

  return {
    message:          responseText,
    quickActions,
    leadUpdates:      Object.keys(leadUpdates).length > 0 ? leadUpdates : undefined,
    shouldQualify:    false,
    shouldBookMeeting,
    shouldEscalate,
  };
}

