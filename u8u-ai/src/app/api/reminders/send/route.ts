import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppMessage, sendSMSMessage } from '@/lib/communications';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const reminderIds = Array.isArray(body.reminderIds) ? body.reminderIds : undefined;

    const pendingReminders = await prisma.reminderLog.findMany({
      where: {
        status: 'PENDING',
        ...(reminderIds?.length ? { id: { in: reminderIds } } : {}),
      },
      include: {
        appointment: {
          include: {
            patient: true,
            doctor: true,
            department: true,
          },
        },
      },
      take: 50, // Process max 50 at a time to avoid overwhelming service
    });

    if (pendingReminders.length === 0) {
      return NextResponse.json({ message: 'No pending reminders', processed: 0 });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const reminder of pendingReminders) {
      try {
        let sendResult;
        const phone = reminder.patientId
          ? reminder.appointment?.patient?.phone
          : null;
        const message =
          reminder.messageBody ||
          `Your appointment is scheduled for ${reminder.appointment?.scheduledAt?.toLocaleString('en-IN')}.`;

        if (!phone || !message) {
          await prisma.reminderLog.update({
            where: { id: reminder.id },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              errorMessage: 'Missing patient phone or message body',
            },
          }).catch(() => null);
          results.push({
            reminderLogId: reminder.id,
            status: 'failed',
            error: 'Missing patient phone or message body',
          });
          continue;
        }

        console.log(`[Reminder Send] Processing ${reminder.channel} to ${phone}`);

        if (reminder.channel === 'WHATSAPP') {
          sendResult = await sendWhatsAppMessage(
            phone,
            message
          );
          console.log(`[WhatsApp Send Result]`, sendResult);
        } else if (reminder.channel === 'SMS') {
          sendResult = await sendSMSMessage(
            phone,
            message
          );
          console.log(`[SMS Send Result]`, sendResult);
        } else {
          continue; // Skip unsupported channels
        }

        // Update reminder status
        if (sendResult.success) {
          await prisma.reminderLog.update({
            where: { id: reminder.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
            },
          });

          results.push({
            reminderLogId: reminder.id,
            status: 'sent',
            channel: reminder.channel,
            phone,
          });
        } else {
          await prisma.reminderLog.update({
            where: { id: reminder.id },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              errorMessage: sendResult.error,
            },
          });

          results.push({
            reminderLogId: reminder.id,
            status: 'failed',
            channel: reminder.channel,
            error: sendResult.error,
          });
        }
      } catch (error: any) {
        console.error(`[Error processing reminder ${reminder.id}]`, error);

        await prisma.reminderLog.update({
          where: { id: reminder.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage: error.message,
          },
        }).catch(() => null);

        results.push({
          reminderLogId: reminder.id,
          status: 'failed',
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      message: `Processed ${pendingReminders.length} reminders`,
      processed: pendingReminders.length,
      sent: successCount,
      failed: failedCount,
      results,
    });
  } catch (error: any) {
    console.error('[Reminders Send API Error]', error);
    return NextResponse.json(
      { error: error.message ?? 'Failed to process reminders' },
      { status: 500 }
    );
  }
}
