import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processAgentMessage } from '@/lib/agents/brain';
import sgMail from '@sendgrid/mail';
import twilio from 'twilio';

export const dynamic = 'force-dynamic';

// ── Init clients ──────────────────────────────────────────────────────────────
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// ── Send appointment confirmation email ───────────────────────────────────────
async function sendAppointmentEmail(params: {
  patientEmail: string;
  patientName: string;
  hospitalName: string;
  hospitalAddress?: string;
  department: string;
  date: string;
  time: string;
  agentName: string;
}) {
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
    console.log('[Email] SendGrid not configured — skipping email');
    return false;
  }

  const address = params.hospitalAddress || process.env.HOSPITAL_ADDRESS || '';

  try {
    await sgMail.send({
      to: params.patientEmail,
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: params.hospitalName },
      subject: `Appointment Confirmation — ${params.hospitalName}`,
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f8f8f8; margin: 0; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 28px 32px;">
      <h1 style="color: #fff; margin: 0; font-size: 22px;">🏥 Appointment Confirmed</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">${params.hospitalName}</p>
    </div>

    <!-- Body -->
    <div style="padding: 28px 32px;">
      <p style="color: #333; font-size: 15px; margin: 0 0 20px;">Dear <strong>${params.patientName}</strong>,</p>
      <p style="color: #555; font-size: 14px; margin: 0 0 24px;">Your appointment has been successfully booked. Here are your appointment details:</p>

      <!-- Details card -->
      <div style="background: #f0f0ff; border-left: 4px solid #6366f1; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #888; font-size: 13px; padding: 5px 0; width: 120px;">Department</td>
            <td style="color: #333; font-size: 14px; font-weight: 600; padding: 5px 0;">${params.department}</td>
          </tr>
          <tr>
            <td style="color: #888; font-size: 13px; padding: 5px 0;">Date</td>
            <td style="color: #333; font-size: 14px; font-weight: 600; padding: 5px 0;">${params.date || 'To be confirmed'}</td>
          </tr>
          <tr>
            <td style="color: #888; font-size: 13px; padding: 5px 0;">Time</td>
            <td style="color: #333; font-size: 14px; font-weight: 600; padding: 5px 0;">${params.time || 'To be confirmed'}</td>
          </tr>
          <tr>
            <td style="color: #888; font-size: 13px; padding: 5px 0;">Patient</td>
            <td style="color: #333; font-size: 14px; font-weight: 600; padding: 5px 0;">${params.patientName}</td>
          </tr>
          ${address ? `
          <tr>
            <td style="color: #888; font-size: 13px; padding: 5px 0;">Location</td>
            <td style="color: #333; font-size: 14px; font-weight: 600; padding: 5px 0;">${address}</td>
          </tr>` : ''}
        </table>
      </div>

      <p style="color: #555; font-size: 14px; margin: 0 0 8px;">📋 <strong>What to bring:</strong></p>
      <ul style="color: #555; font-size: 14px; margin: 0 0 24px; padding-left: 20px;">
        <li>Valid photo ID / Aadhar card</li>
        <li>Previous medical records (if any)</li>
        <li>Insurance card (if applicable)</li>
        <li>List of current medicines</li>
      </ul>

      <p style="color: #555; font-size: 13px; margin: 0 0 6px;">⏰ Please arrive 15 minutes before your appointment time.</p>
      <p style="color: #555; font-size: 13px; margin: 0 0 24px;">📞 For any changes or queries, please call the hospital reception.</p>

      <p style="color: #333; font-size: 14px; margin: 0;">Warm regards,<br>
      <strong>${params.agentName}</strong><br>
      <span style="color: #888;">AI Health Assistant, ${params.hospitalName}</span></p>
    </div>

    <!-- Footer -->
    <div style="background: #f8f8f8; padding: 16px 32px; border-top: 1px solid #eee;">
      <p style="color: #aaa; font-size: 12px; margin: 0; text-align: center;">This is an automated confirmation from ${params.hospitalName}'s AI assistant.</p>
    </div>
  </div>
</body>
</html>
      `,
    });
    console.log(`[Email] Appointment confirmation sent to ${params.patientEmail}`);
    return true;
  } catch (err: any) {
    console.error('[Email] Failed to send appointment email:', err?.message ?? err);
    return false;
  }
}

// ── Send appointment confirmation SMS ─────────────────────────────────────────
async function sendAppointmentSMS(params: {
  phone: string;
  patientName: string;
  hospitalName: string;
  department: string;
  date: string;
  time: string;
}) {
  if (!twilioClient || !process.env.TWILIO_PHONE_NUMBER) {
    console.log('[SMS] Twilio not configured — skipping SMS');
    return false;
  }

  try {
    const msg = `Hi ${params.patientName}! Your appointment at ${params.hospitalName} is confirmed.\nDepartment: ${params.department}\nDate: ${params.date || 'TBD'}\nTime: ${params.time || 'TBD'}\nPlease arrive 15 mins early. Reply STOP to unsubscribe.`;

    await twilioClient.messages.create({
      body: msg,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: params.phone,
    });
    console.log(`[SMS] Appointment confirmation sent to ${params.phone}`);
    return true;
  } catch (err: any) {
    console.error('[SMS] Failed to send appointment SMS:', err?.message ?? err);
    return false;
  }
}

// ── Extract appointment details from conversation ─────────────────────────────
function extractAppointmentDetails(messages: { role: string; content: string }[]): {
  department: string; date: string; time: string; patientName: string;
} {
  // Only look at USER messages to avoid picking up Assistant examples
  const userMessages = messages.filter(m => m.role === 'user');
  const userText = userMessages.map(m => m.content).join(' ').toLowerCase();
  
  // Also keep full text but prioritize user input
  const fullText = messages.map(m => m.content).join(' ').toLowerCase();

  // Extract department - prioritize user mention, then search full history
  let department = 'General Physician';
  const depts = [
    { key: 'cardio', val: 'Cardiology' }, { key: 'derma', val: 'Dermatology' },
    { key: 'ortho', val: 'Orthopaedics' }, { key: 'paediat', val: 'Paediatrics' },
    { key: 'ophthal', val: 'Ophthalmology' }, { key: 'ent', val: 'ENT' },
    { key: 'gastro', val: 'Gastroenterology' }, { key: 'neuro', val: 'Neurology' },
    { key: 'gynae', val: 'Gynaecology' }, { key: 'gynecol', val: 'Gynaecology' },
    { key: 'pulmo', val: 'Pulmonology' }, { key: 'general physician', val: 'General Physician' },
    { key: 'general medicine', val: 'General Physician' },
    { key: 'psychiatr', val: 'Psychiatry' }, { key: 'nephrolo', val: 'Nephrology' },
  ];

  // Search in user messages first (most accurate)
  for (const d of depts) {
    // Use regex for word boundaries to avoid matching "ent" in "appointment"
    const regex = new RegExp(`\\b${d.key}\\b`, 'i');
    if (regex.test(userText)) { department = d.val; break; }
  }

  // If user says "yes" or "sure", check the assistant's last suggestion
  const lastUserMsg = userMessages[userMessages.length - 1]?.content.toLowerCase() || '';
  if (department === 'General Physician' && (lastUserMsg.includes('yes') || lastUserMsg.includes('sure') || lastUserMsg.includes('ok'))) {
    // Look at the last assistant message before this "yes"
    const lastAsstIdx = messages.findLastIndex((m, i) => m.role === 'assistant' && i < messages.length - 1);
    if (lastAsstIdx >= 0) {
      const asstText = messages[lastAsstIdx].content.toLowerCase();
      for (const d of depts) {
        const regex = new RegExp(`\\b${d.key}\\b`, 'i');
        if (regex.test(asstText)) { department = d.val; break; }
      }
    }
  }

  // Fallback to full history if still not found
  if (department === 'General Physician') {
    for (const d of depts) {
      const regex = new RegExp(`\\b${d.key}\\b`, 'i');
      if (regex.test(fullText)) { department = d.val; break; }
    }
  }

  // Extract date - look at user messages from latest to oldest
  let date = '';
  const datePatterns = [
    /\b(tomorrow)\b/,
    /\b(today)\b/,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
    /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/,
    /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*)\b/i,
  ];

  for (let i = userMessages.length - 1; i >= 0; i--) {
    const msg = userMessages[i].content.toLowerCase();
    for (const p of datePatterns) {
      const m = msg.match(p);
      if (m) { date = m[1]; break; }
    }
    if (date) break;
  }

  // Extract time - look at user messages from latest to oldest
  let time = '';
  const timePattern = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i;
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const m = userMessages[i].content.match(timePattern);
    if (m) { time = m[1]; break; }
  }

  // Extract patient name
  let patientName = '';
  // Strategy 1: Look for user message after "share your full name" or "what is your name"
  for (let i = 0; i < messages.length - 1; i++) {
    const asstMsg = messages[i];
    const nextMsg = messages[i + 1];
    if (asstMsg.role === 'assistant' && 
        (asstMsg.content.toLowerCase().includes('full name') || asstMsg.content.toLowerCase().includes('your name')) &&
        nextMsg.role === 'user') {
      patientName = nextMsg.content.trim();
      break;
    }
  }

  // Strategy 2: Fallback to "hello [Name]" in assistant messages
  if (!patientName) {
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.content.toLowerCase().includes('hello')) {
        const nameMatch = msg.content.match(/hello\s+([A-Z][a-z]+)/i);
        if (nameMatch) { patientName = nameMatch[1]; break; }
      }
    }
  }

  return { department, date, time, patientName };
}

function parsePreferredDateTime(dateText: string, timeText: string): Date {
  const now = new Date();
  const dt = new Date(now);
  dt.setSeconds(0, 0);
  dt.setMilliseconds(0);
  
  const lowerDate = (dateText || '').toLowerCase();
  const lowerTime = (timeText || '').toLowerCase();

  // 1. Resolve Date
  if (lowerDate.includes('tomorrow')) {
    dt.setDate(dt.getDate() + 1);
  } else if (lowerDate.includes('today')) {
    // Keep current date
  } else {
    const dow = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const idx = dow.findIndex((d) => lowerDate.includes(d));
    if (idx >= 0) {
      const currentDay = now.getDay();
      const delta = (idx - currentDay + 7) % 7 || 7;
      dt.setDate(dt.getDate() + delta);
    } else {
      // Try parsing numeric date (DD/MM/YYYY)
      const numericMatch = lowerDate.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
      if (numericMatch) {
        const day = parseInt(numericMatch[1], 10);
        const month = parseInt(numericMatch[2], 10) - 1;
        const year = numericMatch[3] ? (numericMatch[3].length === 2 ? 2000 + parseInt(numericMatch[3], 10) : parseInt(numericMatch[3], 10)) : now.getFullYear();
        dt.setFullYear(year, month, day);
      }
    }
  }

  // 2. Resolve Time
  const m = lowerTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (m) {
    let hh = parseInt(m[1], 10);
    const mm = parseInt(m[2] || '0', 10);
    const ap = (m[3] || '').toLowerCase();
    
    if (ap === 'pm' && hh < 12) hh += 12;
    if (ap === 'am' && hh === 12) hh = 0;
    
    // If no AM/PM, and hour is 1-8, assume PM (hospital hours)
    if (!ap && hh >= 1 && hh <= 8) hh += 12;

    dt.setHours(hh, mm, 0, 0);
  } else {
    // Default to 10 AM if no time found
    dt.setHours(10, 0, 0, 0);
  }

  // 3. Past-date safety: If date/time is in the past, and it was "today", push to tomorrow
  // But be careful! If the user says "Today 2PM" and it's 2:05 PM, pushing to tomorrow might be wrong.
  // We only push if the difference is more than 30 mins or if date is definitely in the past.
  if (dt.getTime() < now.getTime() - 1000 * 60 * 30) {
    dt.setDate(dt.getDate() + 1);
  }
  
  return dt;
}

function isDoctorAvailableForDate(availability: unknown, selectedDate: Date): boolean {
  if (!availability || typeof availability !== 'object') return true;
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][selectedDate.getDay()];
  const avail = availability as Record<string, any>;
  const dayAvail = avail[dayName] ?? avail[dayName.slice(0, 3)] ?? avail[dayName.toLowerCase()];
  if (!dayAvail) return true;
  if (Array.isArray(dayAvail)) return dayAvail.length > 0;
  if (typeof dayAvail === 'object' && dayAvail !== null && 'isAvailable' in dayAvail) return dayAvail.isAvailable !== false;
  return true;
}

// ── Main POST handler ─────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, message, sessionId, email, firstName, lastName, fullName, phone } = body;

    if (!agentId || !message) {
      return NextResponse.json({ success: false, error: 'agentId and message are required' }, { status: 400 });
    }

    // Fetch agent
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: { organization: true },
    });

    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
    if (!agent.isActive) return NextResponse.json({ success: false, error: 'Agent is not active' }, { status: 400 });

    const agentAny = agent as any;
    const hospitalName = process.env.HOSPITAL_NAME ?? agentAny.companyName ?? (agent.organization as any)?.name ?? 'City Hospital';

    // Find or create conversation
    let conversation = sessionId
      ? await prisma.conversation.findUnique({
        where: { sessionId },
        include: { lead: true, messages: { orderBy: { id: 'asc' } } },
      })
      : null;

    if (!conversation) {
      // Find or create lead
      let lead = null;
      if (email || phone) {
        lead = await prisma.lead.findFirst({
          where: {
            organizationId: agent.organizationId,
            OR: [
              ...(email ? [{ email }] : []),
              ...(phone ? [{ phone }] : []),
            ],
          },
        });
        if (!lead) {
          const resolvedFirstName = firstName ?? fullName?.split(' ')[0] ?? null;
          const resolvedLastName = lastName ?? (fullName?.split(' ').slice(1).join(' ') || null);
          lead = await prisma.lead.create({
            data: {
              organizationId: agent.organizationId,
              email: email ?? `chat_${Date.now()}@guest.local`,
              firstName: resolvedFirstName,
              lastName: resolvedLastName,
              phone: phone ?? null,
              source: 'chat',
              status: 'NEW',
            },
          });
        } else if (phone && !lead.phone) {
          // Update phone if we now have it
          await prisma.lead.update({ where: { id: lead.id }, data: { phone } });
        }
      }

      const newSession = sessionId ?? `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      conversation = await prisma.conversation.create({
        data: {
          organizationId: agent.organizationId,
          agentId: agent.id,
          leadId: lead?.id ?? null,
          channel: 'CHAT',
          status: 'ACTIVE',
          sessionId: newSession,
          startedAt: new Date(),
        },
        include: { lead: true, messages: { orderBy: { id: 'asc' } } },
      });

      if (lead) {
        await prisma.lead.update({ where: { id: lead.id }, data: { status: 'CONTACTED' } });
      }
    }

    // If contact details are shared later in chat, attach/update lead on the same conversation.
    const resolvedFirstName = firstName ?? fullName?.trim().split(' ')[0] ?? null;
    const resolvedLastName = lastName ?? (fullName?.trim().split(' ').slice(1).join(' ') || null);
    if (email || phone || fullName) {
      if (!conversation.lead && (email || phone)) {
        let lead = await prisma.lead.findFirst({
          where: {
            organizationId: agent.organizationId,
            OR: [
              ...(email ? [{ email }] : []),
              ...(phone ? [{ phone }] : []),
            ],
          },
        });

        if (!lead) {
          lead = await prisma.lead.create({
            data: {
              organizationId: agent.organizationId,
              email: email ?? `chat_${Date.now()}@guest.local`,
              firstName: resolvedFirstName,
              lastName: resolvedLastName,
              phone: phone ?? null,
              source: 'chat',
              status: 'CONTACTED',
            },
          });
        }

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { leadId: lead.id },
        });
        conversation = { ...conversation, lead };
      } else if (conversation.lead) {
        const leadUpdates: Record<string, string> = {};
        if (email && conversation.lead.email !== email) leadUpdates.email = email;
        if (phone && conversation.lead.phone !== phone) leadUpdates.phone = phone;
        
        // Always update name if provided, even if already set
        if (resolvedFirstName && conversation.lead.firstName !== resolvedFirstName) leadUpdates.firstName = resolvedFirstName;
        if (resolvedLastName && conversation.lead.lastName !== resolvedLastName) leadUpdates.lastName = resolvedLastName;

        if (Object.keys(leadUpdates).length > 0) {
          const updatedLead = await prisma.lead.update({
            where: { id: conversation.lead.id },
            data: leadUpdates,
          });
          conversation = { ...conversation, lead: updatedLead };
        }
      }
    }

    // Save user message
    await prisma.message.create({
      data: { conversationId: conversation.id, role: 'user', content: message },
    });

    // Call hospital brain
    const agentResponse = await processAgentMessage(message, {
      agent,
      lead: conversation.lead,
      conversationHistory: conversation.messages,
      channel: 'chat',
      sessionId: conversation.sessionId ?? undefined,
    });

    // Save AI response
    await prisma.message.create({
      data: { conversationId: conversation.id, role: 'assistant', content: agentResponse.message },
    });

    // Update lead if needed
    if (agentResponse.leadUpdates && Object.keys(agentResponse.leadUpdates).length > 0 && conversation.lead) {
      await prisma.lead.update({
        where: { id: conversation.lead.id },
        data: agentResponse.leadUpdates as any,
      });
    }

    // ── APPOINTMENT BOOKING: Save as Appointment with available doctor ─────
    const aiMsg = agentResponse.message.toLowerCase();
    const isAppointmentConfirmed =
      agentResponse.shouldBookMeeting ||
      (aiMsg.includes('appointment') && (
        aiMsg.includes('booked') || aiMsg.includes('confirmed') ||
        aiMsg.includes('noted') || aiMsg.includes('scheduled')
      ));

    if (isAppointmentConfirmed && conversation.lead) {
      const lead = conversation.lead;
      const allMessages = [...conversation.messages, { role: 'user', content: message }, { role: 'assistant', content: agentResponse.message }];
      const apptDetails = extractAppointmentDetails(allMessages);
      
      // Prioritize the name extracted from the current conversation over the old lead name
      const patientName = apptDetails.patientName || lead.firstName || 'Patient';
      const patientEmail = lead.email;
      const patientPhone = lead.phone ?? phone ?? null;

      // Resolve date/time and department first.
      const scheduledAt = parsePreferredDateTime(apptDetails.date, apptDetails.time);
      const department = await prisma.department.findFirst({
        where: {
          organizationId: agent.organizationId,
          name: { contains: apptDetails.department.split(' ')[0] || 'General', mode: 'insensitive' },
          isActive: true,
        },
        select: { id: true, name: true },
      });

      // Pick an available doctor from that department, if possible.
      let selectedDoctor: { id: string; name: string } | null = null;
      if (department?.id) {
        const doctors = await prisma.doctor.findMany({
          where: {
            organizationId: agent.organizationId,
            departmentId: department.id,
            isActive: true,
            appointments: {
              none: {
                scheduledAt,
                status: { in: ['SCHEDULED', 'CONFIRMED', 'RESCHEDULED'] as any },
              },
            },
          },
          select: { id: true, name: true, availability: true },
          take: 20,
        });
        const availableDoctor = doctors.find((d) => isDoctorAvailableForDate(d.availability, scheduledAt));
        if (availableDoctor) selectedDoctor = { id: availableDoctor.id, name: availableDoctor.name };
      }

      // Ensure patient exists so appointments appear in dashboard pages.
      let patient = await prisma.patient.findFirst({
        where: {
          organizationId: agent.organizationId,
          OR: [
            ...(lead.phone ? [{ phone: lead.phone }] : []),
            ...(lead.email ? [{ email: lead.email }] : []),
          ],
        },
        select: { id: true },
      });

      if (!patient) {
        patient = await prisma.patient.create({
          data: {
            organizationId: agent.organizationId,
            firstName: lead.firstName ?? patientName,
            lastName: lead.lastName ?? null,
            fullName: `${lead.firstName ?? patientName} ${lead.lastName ?? ''}`.trim(),
            phone: lead.phone ?? null,
            email: lead.email ?? null,
            departmentId: department?.id ?? null,
            source: 'chat',
            patientStatus: 'CONTACTED',
          },
          select: { id: true },
        });
      }

      // Save appointment to DB (dashboard consumes this).
      try {
        const appointment = await prisma.appointment.create({
          data: {
            organizationId: agent.organizationId,
            patientId: patient.id,
            departmentId: department?.id ?? null,
            doctorId: selectedDoctor?.id ?? null,
            scheduledAt,
            appointmentType: 'CONSULTATION',
            notes: `Booked via AI chat. LeadId=${lead.id}`,
            status: 'SCHEDULED',
          },
          include: {
            doctor: { select: { name: true } },
            department: { select: { name: true } },
          },
        });

        const bookedDeptName = appointment.department?.name ?? apptDetails.department ?? 'General';
        const bookedDoctorName = appointment.doctor?.name ?? selectedDoctor?.name ?? 'Doctor will be assigned';
        const bookedDate = scheduledAt.toLocaleDateString('en-IN');
        const bookedTime = scheduledAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        agentResponse.message += `\n\n✅ Appointment booked for ${bookedDate} at ${bookedTime} with ${bookedDoctorName} (${bookedDeptName}).`;
      } catch (e) {
        console.error('[Appointment] DB save failed:', e);
      }

      // Log activity
      await prisma.activity.create({
        data: {
          leadId: lead.id,
          type: 'appointment_booked',
          title: `Appointment booked — ${apptDetails.department}`,
          description: `Patient: ${patientName} | Date: ${apptDetails.date || 'TBD'} | Time: ${apptDetails.time || 'TBD'}`,
          actorType: 'agent',
          actorId: agent.id,
          metadata: { ...apptDetails, patientEmail, patientPhone, hospitalName },
        },
      }).catch(() => null);

      // Send email confirmation
      let emailSent = false;
      if (patientEmail && !patientEmail.includes('@voice.local') && !patientEmail.includes('@phonecall.local')) {
        emailSent = await sendAppointmentEmail({
          patientEmail,
          patientName,
          hospitalName,
          hospitalAddress: process.env.HOSPITAL_ADDRESS,
          department: apptDetails.department,
          date: apptDetails.date,
          time: apptDetails.time,
          agentName: agent.name,
        });
      }

      // Send SMS confirmation
      let smsSent = false;
      if (patientPhone) {
        smsSent = await sendAppointmentSMS({
          phone: patientPhone,
          patientName,
          hospitalName,
          department: apptDetails.department,
          date: apptDetails.date,
          time: apptDetails.time,
        });
      }

      // Tell AI to mention confirmation status in a follow-up note
      const confirmNote = emailSent || smsSent
        ? `\n\n✅ Confirmation sent${emailSent ? ` to ${patientEmail}` : ''}${smsSent ? ` and SMS to ${patientPhone}` : ''}.`
        : patientEmail
          ? `\n\n⚠️ Note: We were unable to send the confirmation email right now. Please note your appointment details: ${apptDetails.department}${apptDetails.date ? ` on ${apptDetails.date}` : ''}${apptDetails.time ? ` at ${apptDetails.time}` : ''}.`
          : '';

      if (confirmNote) {
        // Append to the saved AI message
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            content: confirmNote,
          },
        });
        agentResponse.message += confirmNote;
      }
    }

    // Increment org conversation count
    await prisma.organization.update({
      where: { id: agent.organizationId },
      data: { conversationCount: { increment: 1 } },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      message: agentResponse.message,
      quickActions: agentResponse.quickActions ?? [],
      sessionId: conversation.sessionId,
      leadUpdated: false,
    });

  } catch (error: any) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Something went wrong. Please try again.',
        message: "I'm having trouble connecting right now. Please try again in a moment.",
      },
      { status: 500 },
    );
  }
}
