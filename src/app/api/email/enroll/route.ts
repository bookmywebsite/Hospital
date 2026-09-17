import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface EnrollBody {
  patientId?: string;
  leadId?: string;
  sequenceId: string;
}

/**
 * POST /api/email/enroll
 * Enroll patient or lead in an email sequence
 * Automatically sends first email
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const orgId = user.organizationId;
    const body: EnrollBody = await req.json();

    const { patientId, leadId, sequenceId } = body;

    if (!sequenceId) {
      return NextResponse.json({ error: 'sequenceId required' }, { status: 400 });
    }

    if (!patientId && !leadId) {
      return NextResponse.json({ error: 'patientId or leadId required' }, { status: 400 });
    }

    // Get sequence
    const sequence = await prisma.emailSequence.findFirst({
      where: {
        id: sequenceId,
        organizationId: orgId,
      },
      include: {
        steps: { orderBy: { stepNumber: 'asc' } },
        agent: { select: { name: true, role: true, companyName: true, companyDescription: true } },
      },
    });

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    // Get patient or lead contact info
    let email = '';
    let contactName = '';

    if (patientId) {
      const patient = await prisma.patient.findFirst({
        where: { id: patientId, organizationId: orgId },
      });
      if (!patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
      }
      email = patient.email || '';
      contactName = patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
    } else {
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, organizationId: orgId },
      });
      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }
      email = lead.email || '';
      contactName = lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Contact does not have an email address' },
        { status: 400 }
      );
    }

    // Check if already enrolled
    const existing = await prisma.sequenceEnrollment.findFirst({
      where: {
        sequenceId,
        ...(patientId && { patientId }),
        ...(leadId && { leadId }),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Already enrolled in this sequence' },
        { status: 409 }
      );
    }

    // Create enrollment
    const enrollment = await prisma.sequenceEnrollment.create({
      data: {
        sequenceId,
        ...(patientId && { patientId }),
        ...(leadId && { leadId }),
        currentStep: 1,
        status: 'active',
        nextStepAt: new Date(), // Send first email immediately
      },
    });

    // Get first step
    const firstStep =
      sequence.steps.length > 0 ? sequence.steps[0] : null;

    if (firstStep) {
      // Create email record
      const emailRecord = await prisma.email.create({
        data: {
          ...(patientId && { patientId }),
          ...(leadId && { leadId }),
          direction: 'outbound',
          subject: firstStep.subjectTemplate || `Hello ${contactName}`,
          body: firstStep.bodyTemplate || `Hi ${contactName}, we would like to connect with you.`,
          bodyHtml: `<p>Hi ${contactName},</p><p>${firstStep.bodyTemplate || 'We would like to connect with you.'}</p>`,
          fromEmail: 'noreply@hospital-ai.local',
          fromName: sequence.agent?.name || 'Hospital AI',
          toEmail: email,
          toName: contactName,
          status: 'QUEUED',
          sequenceId,
          sequenceStep: 1,
          intent: 'outreach',
        },
      });

      // Update enrollment
      await prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { nextStepAt: new Date() },
      });
    }

    // Increment enrollment count
    await prisma.emailSequence.update({
      where: { id: sequenceId },
      data: { totalEnrolled: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      enrollment: {
        id: enrollment.id,
        sequenceId,
        sequenceName: sequence.name,
        contactEmail: email,
        contactName,
        currentStep: 1,
        totalSteps: sequence.steps.length,
        status: 'active',
        enrolledAt: enrollment.enrolledAt.toISOString(),
        nextStepAt: enrollment.nextStepAt?.toISOString(),
      },
      message: `Successfully enrolled in "${sequence.name}" sequence. First email queued for sending.`,
    });
  } catch (error: any) {
    console.error('[Email Enroll] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to enroll' }, { status: 500 });
  }
}
