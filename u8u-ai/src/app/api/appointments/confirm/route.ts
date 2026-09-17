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

    if (!appointmentId) {
      return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 });
    }

    // Get appointment with patient details
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        organizationId: user.organizationId,
      },
      include: {
        patient: { select: { id: true, phone: true, email: true, firstName: true, lastName: true, fullName: true, preferredLanguage: true } },
        doctor: { select: { id: true, name: true, specialization: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    // Update appointment status to CONFIRMED
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CONFIRMED',
      },
      include: {
        patient: true,
        doctor: true,
        department: true,
      },
    });

    // Send confirmation to patient via WhatsApp AND SMS if phone exists
    if (appointment.patient?.phone) {
      const appointmentTime = new Date(appointment.scheduledAt).toLocaleString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const message = `Hi ${appointment.patient.firstName || 'there'}, your appointment is confirmed!\n\n📅 Date & Time: ${appointmentTime}\n🏥 Department: ${appointment.department?.name || 'General'}\n👨‍⚕️ Doctor: ${appointment.doctor?.name || 'TBD'}\n\nPlease arrive 10 minutes early. Reply STOP to opt out.`;

      // Send both WhatsApp and SMS for comprehensive confirmation
      const whatsappResult = await sendWhatsAppMessage(appointment.patient.phone, message);
      const smsResult = await sendSMSMessage(appointment.patient.phone, message);

      const whatsappReminder = await prisma.reminderLog.create({
        data: {
          appointmentId,
          patientId: appointment.patient.id,
          channel: 'WHATSAPP',
          status: whatsappResult.success ? 'SENT' : 'FAILED',
          sentAt: whatsappResult.success ? new Date() : null,
          failedAt: whatsappResult.success ? null : new Date(),
          errorMessage: whatsappResult.success ? null : (whatsappResult.error || 'Failed to send confirmation'),
          messageBody: message,
        },
      }).catch(() => null);

      const smsReminder = await prisma.reminderLog.create({
        data: {
          appointmentId,
          patientId: appointment.patient.id,
          channel: 'SMS',
          status: smsResult.success ? 'SENT' : 'FAILED',
          sentAt: smsResult.success ? new Date() : null,
          failedAt: smsResult.success ? null : new Date(),
          errorMessage: smsResult.success ? null : (smsResult.error || 'Failed to send confirmation'),
          messageBody: message,
        },
      }).catch(() => null);

      // Log activity for patient
      let confirmationDesc = `Your appointment on ${appointmentTime} has been confirmed via `;
      confirmationDesc += whatsappResult.success ? 'WhatsApp' : '';
      confirmationDesc += (whatsappResult.success && smsResult.success) ? ' & SMS' : (smsResult.success ? 'SMS' : '');
      if (!smsResult.success && smsResult.isTrialAccountError) {
        confirmationDesc += ' (SMS requires phone verification on trial account)';
      }

      await prisma.activity.create({
        data: {
          patientId: appointment.patient.id,
          type: 'appointment_confirmed',
          title: 'Appointment confirmed',
          description: confirmationDesc,
          actorType: 'user',
          actorId: user.id,
          metadata: {
            appointmentId,
            sendTo: appointment.patient.phone,
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
    }

    // Notify doctor if assigned
    if (appointment.doctorId) {
      await prisma.activity.create({
        data: {
          type: 'appointment_assigned',
          title: `New appointment: ${appointment.patient?.fullName || 'Patient'}`,
          description: `${appointment.appointmentType} appointment confirmed for ${new Date(appointment.scheduledAt).toLocaleDateString()}`,
          actorType: 'system',
          actorId: user.id,
          metadata: { appointmentId, doctorId: appointment.doctorId, patientName: appointment.patient?.fullName },
        },
      }).catch(() => null);
    }

    return NextResponse.json({ success: true, appointment: updatedAppointment });
  } catch (error: any) {
    console.error('[Confirm Appointment API]', error);
    return NextResponse.json({ error: error.message ?? 'Failed to confirm appointment' }, { status: 500 });
  }
}
