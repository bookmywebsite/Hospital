import sgMail from '@sendgrid/mail';
import sgClient from '@sendgrid/client';
import Groq from 'groq-sdk';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
sgClient.setApiKey(process.env.SENDGRID_API_KEY!);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
    to: string;
    toName?: string;
    subject: string;
    html: string;
    text?: string;
    fromEmail?: string;
    fromName?: string;
    replyTo?: string;
    threadId?: string;
    attachments?: Array<{
        content: string;
        filename: string;
        type?: string;
        disposition?: string;
    }>;
}

export interface GenerateEmailOptions {
    agentName: string;
    agentRole: string;
    companyName?: string;
    companyDescription?: string;
    productDescription?: string;
    valueProposition?: string;
    leadFirstName?: string;
    leadCompany?: string;
    leadJobTitle?: string;
    painPoints?: string[];
    previousConversationSummary?: string;
    stepNumber: number;
    totalSteps: number;
    previousEmailSubject?: string;
    tone?: string;
}

// ─── Send a single email via SendGrid ─────────────────────────────────────────

export async function sendEmail(options: SendEmailOptions): Promise<string> {
    const msg = {
        to: { email: options.to, name: options.toName ?? options.to },
        from: {
            email: options.fromEmail ?? process.env.SENDGRID_FROM_EMAIL!,
            name: options.fromName ?? process.env.SENDGRID_FROM_NAME ?? 'PrimePro.ai',
        },
        replyTo: options.replyTo ?? process.env.SENDGRID_FROM_EMAIL!,
        subject: options.subject,
        html: options.html,
        text: options.text ?? options.html.replace(/<[^>]*>/g, ''),
        headers: options.threadId
            ? { 'X-Thread-ID': options.threadId, 'In-Reply-To': options.threadId } as { [key: string]: string }
            : undefined,
        attachments: options.attachments,
        trackingSettings: {
            clickTracking: { enable: true },
            openTracking: { enable: true },
        },
    };

    const [response] = await sgMail.send(msg);
    // SendGrid returns message ID in headers
    const messageId = (response.headers as Record<string, string>)['x-message-id'] ?? `sg_${Date.now()}`;
    return messageId;
}

// ─── AI-generate email content via Groq ───────────────────────────────────────

export async function generateEmailContent(
    opts: GenerateEmailOptions
): Promise<{ subject: string; html: string; text: string }> {
    const isFollowUp = opts.stepNumber > 1;

const prompt = `You are ${opts.agentName}, ${opts.agentRole} at ${opts.companyName ?? 'our hospital'}. You write formal, professional, and patient-focused hospital correspondence.

Write a ${isFollowUp ? 'follow-up' : 'support'} email for a hospital inquiry.

CONTEXT:
- Hospital: ${opts.companyName ?? 'our hospital'}
- Hospital description: ${opts.companyDescription ?? 'hospital care and patient support'}
- Inquiry focus: ${opts.productDescription ?? 'hospital queries, appointment support, and care coordination'}
- What we offer: ${opts.valueProposition ?? 'answering patient questions promptly and guiding them through their hospital request'}
- Lead Name: ${opts.leadFirstName ?? 'there'}
- Lead Company: ${opts.leadCompany ?? 'your organization'}
- Lead Title: ${opts.leadJobTitle ?? ''}
- Known concerns: ${opts.painPoints?.join(', ') ?? 'no specific concerns yet'}
- Previous conversation notes: ${opts.previousConversationSummary ?? 'No prior conversation details available'}
- Sequence Step: ${opts.stepNumber} of ${opts.totalSteps}
- Tone: ${opts.tone ?? 'formal and professional'}
${isFollowUp ? `- Following up on: "${opts.previousEmailSubject ?? 'previous inquiry'}"` : ''}

RULES:
- Write a complete email with a professional greeting, concise summary, clear purpose, next steps, and a courteous closing.
- Use at least three paragraphs and keep each paragraph focused on one idea.
- If previous conversation details exist, reference them and make the message directly relevant to that prior conversation.
- Avoid sales language, offers, and pricing.
- Focus on hospital query resolution, appointment scheduling, or patient support.
- Subject line: 6-10 words, formal, clear, and support-oriented.
- Body: 120-180 words, polite and concise.
- Include a formal closing with "Regards," and the sender name.
- Do not use phrases like "I hope this email finds you well."
- End with a clear action request or question.

Respond ONLY in this JSON format (no markdown, no extra text):
{"subject":"...","text":"...","html":"..."}

The html field should be the text wrapped in simple HTML with <p> tags and a formal sign-off.`;

    const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        max_tokens: 600,
        temperature: 0.8,
        messages: [{ role: 'user', content: prompt }],
    });

    const raw = completion.choices[0].message.content ?? '{}';

    const buildHtml = (input: string) => {
        const paragraphs = input
            .split(/\n\s*\n/)
            .map(p => p.trim())
            .filter(Boolean);
        return paragraphs.length
            ? paragraphs.map(p => `<p>${p}</p>`).join('\n')
            : `<p>${input}</p>`;
    };

    let parsed: any = null;
    try {
        // 1. Try direct parse of the whole response
        parsed = JSON.parse(raw);
    } catch {
        // 2. If direct parse fails, try to find any valid JSON object block within the text
        // This handles cases where AI outputs: {"subject":...} {"html":...} or JSON followed by text
        const jsonBlocks = raw.match(/\{[\s\S]*?\}/g) || [];
        for (const block of jsonBlocks) {
            try {
                const p = JSON.parse(block);
                if (p.subject || p.text || p.html) {
                    parsed = p;
                    break; // Use the first valid JSON block found
                }
            } catch {
                continue;
            }
        }
    }

    if (parsed) {
        // Successfully found and parsed a JSON block
        let textValue = parsed.text ?? '';
        
        // Safety: If the AI accidentally put a JSON string inside the text/html fields
        const cleanJsonInside = (input: string) => {
            if (typeof input !== 'string') return '';
            if (input.includes('{"subject":') || input.includes('"text":')) {
                // Strip any JSON-like blocks from the start
                return input.replace(/^\{[\s\S]*?\}\s*/g, '').trim();
            }
            return input;
        };

        textValue = cleanJsonInside(textValue);
        let htmlValue = parsed.html ? cleanJsonInside(parsed.html) : buildHtml(textValue);

        return {
            subject: parsed.subject ?? 'Following up',
            text: textValue,
            html: htmlValue,
        };
    } else {
        // Fallback: No valid JSON found. Aggressively strip all {...} blocks from the raw response
        // to leave only the actual human-readable text.
        let cleanedRaw = raw.replace(/\{[\s\S]*?\}/g, '').trim();
        const finalRaw = cleanedRaw || raw;

        return {
            subject: isFollowUp 
                ? `Following up — ${opts.companyName ?? 'PrimePro.ai'}` 
                : `Quick question, ${opts.leadFirstName ?? 'there'}`,
            text: finalRaw,
            html: buildHtml(finalRaw),
        };
    }
}

// ─── Enroll lead in a sequence and send step 1 immediately ────────────────────

export async function enrollLeadInSequence(
    sequenceId: string,
    leadId: string,
    prisma: any
): Promise<void> {
    const sequence = await prisma.emailSequence.findUnique({
        where: { id: sequenceId },
        include: { steps: { orderBy: { stepNumber: 'asc' } }, agent: true },
    });

    if (!sequence || !sequence.isActive) return;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    // Check if already enrolled
    const existing = await prisma.sequenceEnrollment.findUnique({
        where: { sequenceId_leadId: { sequenceId, leadId } },
    });
    if (existing) return;

    // Create enrollment
    const enrollment = await prisma.sequenceEnrollment.create({
        data: {
            sequenceId,
            leadId,
            currentStep: 1,
            status: 'active',
            nextStepAt: new Date(),
        },
    });

    // Update sequence stats
    await prisma.emailSequence.update({
        where: { id: sequenceId },
        data: { totalEnrolled: { increment: 1 } },
    });

    // Send step 1 immediately
    const firstStep = sequence.steps[0];
    if (firstStep) {
        await processSequenceStep(enrollment.id, firstStep.id, lead, sequence, prisma);
    }
}

// ─── Process a single sequence step ───────────────────────────────────────────

export async function processSequenceStep(
    enrollmentId: string,
    stepId: string,
    lead: any,
    sequence: any,
    prisma: any
): Promise<void> {
    const step = sequence.steps.find((s: any) => s.id === stepId);
    if (!step || !step.isActive) return;

    // Skip if lead already replied or booked
    if (step.skipIfReplied && lead.status === 'WON') return;
    if (step.skipIfMeeting && lead.status === 'MEETING_SET') return;

    let subject: string;
    let html: string;
    let text: string;

    if (step.useAI) {
        const generated = await generateEmailContent({
            agentName: sequence.agent?.name ?? 'PrimePro',
            agentRole: sequence.agent?.role ?? 'Hospital AI Assistant',
            companyName: sequence.agent?.companyName ?? '',
            companyDescription: sequence.agent?.companyDescription ?? '',
            productDescription: sequence.agent?.productDescription ?? '',
            valueProposition: sequence.agent?.valueProposition ?? '',
            leadFirstName: lead.firstName ?? '',
            leadCompany: lead.company ?? '',
            leadJobTitle: lead.jobTitle ?? '',
            painPoints: lead.painPoints ?? [],
            stepNumber: step.stepNumber,
            totalSteps: sequence.steps.length,
            tone: sequence.agent?.tone ?? 'conversational',
        });
        subject = generated.subject;
        html = generated.html;
        text = generated.text;
    } else {
        // Use template with variable substitution
        subject = (step.subjectTemplate ?? 'Hello {{firstName}}')
            .replace('{{firstName}}', lead.firstName ?? 'there')
            .replace('{{company}}', lead.company ?? 'your company');
        text = (step.bodyTemplate ?? '')
            .replace('{{firstName}}', lead.firstName ?? 'there')
            .replace('{{company}}', lead.company ?? 'your company');
        html = `<p>${text.replace(/\n/g, '</p><p>')}</p>`;
    }

    // Send email
    const sendGridId = await sendEmail({
        to: lead.email,
        toName: lead.firstName ?? lead.email,
        subject,
        html,
        text,
    });

    // Save to Email table
    await prisma.email.create({
        data: {
            leadId: lead.id,
            direction: 'outbound',
            subject,
            body: text,
            bodyHtml: html,
            fromEmail: process.env.SENDGRID_FROM_EMAIL!,
            fromName: sequence.agent?.name ?? 'PrimePro',
            toEmail: lead.email,
            toName: lead.firstName ?? '',
            sequenceId: sequence.id,
            sequenceStep: step.stepNumber,
            status: 'SENT',
            sendGridId,
            sentAt: new Date(),
        },
    });

    // Update lead email stats
    await prisma.lead.update({
        where: { id: lead.id },
        data: {
            emailsSent: { increment: 1 },
            lastContactedAt: new Date(),
            status: lead.status === 'NEW' ? 'CONTACTED' : lead.status,
        },
    });

    // Log activity
    await prisma.activity.create({
        data: {
            leadId: lead.id,
            type: 'email_sent',
            title: `Email sent: ${subject}`,
            description: `Sequence: ${sequence.name} — Step ${step.stepNumber}`,
            actorType: 'agent',
            actorId: sequence.agentId,
        },
    });

    // Update step stats
    await prisma.emailSequenceStep.update({
        where: { id: step.id },
        data: { totalSent: { increment: 1 } },
    });

    // Schedule next step
    const nextStep = sequence.steps.find((s: any) => s.stepNumber === step.stepNumber + 1);
    if (nextStep) {
        const nextStepAt = new Date();
        nextStepAt.setDate(nextStepAt.getDate() + nextStep.delayDays);
        nextStepAt.setHours(nextStepAt.getHours() + nextStep.delayHours);

        await prisma.sequenceEnrollment.update({
            where: { id: enrollmentId },
            data: { currentStep: nextStep.stepNumber, nextStepAt },
        });
    } else {
        // Sequence complete
        await prisma.sequenceEnrollment.update({
            where: { id: enrollmentId },
            data: { status: 'completed', completedAt: new Date() },
        });
        await prisma.emailSequence.update({
            where: { id: sequence.id },
            data: { totalCompleted: { increment: 1 } },
        });
    }
}