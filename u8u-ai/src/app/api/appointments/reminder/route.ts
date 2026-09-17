import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { sendSMSMessage, sendWhatsAppMessage } from '@/lib/communications';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user?.organizationId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const body = await request.json();
    const { appointmentId, channel = 'WHATSAPP' } = body;
    if (!appointmentId) return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 });

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, organizationId: user.organizationId },
      include: {
        patient: { select: { id: true, firstName: true, phone: true } },
        doctor: { select: { name: true } },
        department: { select: { name: true } },
      },
    });
    if (!appointment?.patient?.phone) {
      return NextResponse.json({ error: 'Patient phone not available' }, { status: 404 });
    }

    const when = new Date(appointment.scheduledAt).toLocaleString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const message = `Reminder: your appointment is scheduled for ${when} with ${appointment.doctor?.name || 'our doctor'} at ${appointment.department?.name || 'General'}.`;

    // Send both WhatsApp and SMS for comprehensive coverage
    const whatsappResult = await sendWhatsAppMessage(appointment.patient.phone, message);
    const smsResult = await sendSMSMessage(appointment.patient.phone, message);

    const whatsappReminder = await prisma.reminderLog.create({
      data: {
        appointmentId: appointment.id,
        patientId: appointment.patient.id,
        channel: 'WHATSAPP',
        status: whatsappResult.success ? 'SENT' : 'FAILED',
        sentAt: whatsappResult.success ? new Date() : null,
        failedAt: whatsappResult.success ? null : new Date(),
        errorMessage: whatsappResult.success ? null : (whatsappResult.error || 'Failed to send reminder'),
        messageBody: message,
      },
    });

    const smsReminder = await prisma.reminderLog.create({
      data: {
        appointmentId: appointment.id,
        patientId: appointment.patient.id,
        channel: 'SMS',
        status: smsResult.success ? 'SENT' : 'FAILED',
        sentAt: smsResult.success ? new Date() : null,
        failedAt: smsResult.success ? null : new Date(),
        errorMessage: smsResult.success ? null : (smsResult.error || 'Failed to send reminder'),
        messageBody: message,
      },
    });

    await prisma.activity.create({
      data: {
        patientId: appointment.patient.id,
        type: (whatsappResult.success || smsResult.success) ? 'appointment_reminder_sent' : 'appointment_reminder_failed',
        title: (whatsappResult.success || smsResult.success) ? 'Appointment reminder sent' : 'Appointment reminder failed',
        description: `${message} [WhatsApp: ${whatsappResult.success ? 'Sent' : 'Failed'}, SMS: ${smsResult.success ? 'Sent' : smsResult.isTrialAccountError ? 'Trial Account - Needs Verification' : 'Failed'}]`,
        actorType: 'user',
        actorId: user.id,
        metadata: {
          appointmentId: appointment.id,
          whatsappReminderId: whatsappReminder.id,
          smsReminderId: smsReminder.id,
          whatsappSuccess: whatsappResult.success,
          smsSuccess: smsResult.success,
          smsTrialAccountError: smsResult.isTrialAccountError ?? false,
          whatsappMessageId: whatsappResult.messageId ?? null,
          smsMessageId: smsResult.messageId ?? null,
          whatsappError: whatsappResult.success ? null : whatsappResult.error,
          smsError: smsResult.success ? null : smsResult.error,
        },
      },
    }).catch(() => null);

    // Success if at least WhatsApp was sent, or both channels succeeded
    const success = whatsappResult.success || smsResult.success;
    const allChannelsFailed = !whatsappResult.success && !smsResult.success && !smsResult.isTrialAccountError;
    
    if (allChannelsFailed) {
      return NextResponse.json(
        { 
          error: 'Failed to send reminder via all channels',
          whatsappError: whatsappResult.error,
          smsError: smsResult.error,
          reminderIds: {
            whatsapp: whatsappReminder.id,
            sms: smsReminder.id,
          }
        },
        { status: 500 },
      );
    }

    // Build user-friendly message
    let userMessage = '✅ Reminder sent via ';
    if (whatsappResult.success) userMessage += 'WhatsApp';
    if (smsResult.success) userMessage += (whatsappResult.success ? ' & SMS' : 'SMS');
    if (!smsResult.success && smsResult.isTrialAccountError) {
      userMessage += (whatsappResult.success ? ' (SMS requires phone verification on trial account)' : '');
    }

    return NextResponse.json({
      success: true,
      reminders: {
        whatsapp: {
          success: whatsappResult.success,
          reminderLogId: whatsappReminder.id,
          messageId: whatsappResult.messageId ?? null,
          error: whatsappResult.error ?? null,
        },
        sms: {
          success: smsResult.success,
          reminderLogId: smsReminder.id,
          messageId: smsResult.messageId ?? null,
          error: smsResult.error ?? null,
          isTrialAccountError: smsResult.isTrialAccountError ?? false,
        },
      },
      message: userMessage,
    });
  } catch (error: any) {
    console.error('[Appointments Reminder]', error);
    return NextResponse.json({ error: error.message || 'Failed to send reminder' }, { status: 500 });
  }
}
