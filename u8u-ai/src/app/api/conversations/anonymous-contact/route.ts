import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface AnonymousContactBody {
  conversationId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  contactType: 'email' | 'whatsapp';
}

/**
 * POST /api/conversations/anonymous-contact
 * Collects email or WhatsApp from anonymous chat users
 * Converts anonymous conversation to associated patient/lead
 */
export async function POST(req: NextRequest) {
  try {
    const body: AnonymousContactBody = await req.json();
    const { conversationId, email, phone, firstName, lastName, contactType } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    if (!contactType || !['email', 'whatsapp'].includes(contactType)) {
      return NextResponse.json({ error: 'contactType must be email or whatsapp' }, { status: 400 });
    }

    if (contactType === 'email' && !email) {
      return NextResponse.json({ error: 'email required when contactType is email' }, { status: 400 });
    }

    if (contactType === 'whatsapp' && !phone) {
      return NextResponse.json({ error: 'phone required when contactType is whatsapp' }, { status: 400 });
    }

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { organization: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const orgId = conversation.organizationId;
    let patientId = conversation.patientId;
    let leadId = conversation.leadId;

    // If no patient/lead linked, create or find one
    if (!patientId && !leadId) {
      // Try to find existing patient by email or phone
      if (email) {
        const existingPatient = await prisma.patient.findFirst({
          where: {
            organizationId: orgId,
            email: email.toLowerCase(),
          },
        });
        if (existingPatient) {
          patientId = existingPatient.id;
        }
      }

      if (!patientId && phone) {
        // Normalize phone for matching
        const normalizedPhone = phone.replace(/[^\d+]/g, '');
        const existingPatient = await prisma.patient.findFirst({
          where: {
            organizationId: orgId,
            phone: { contains: normalizedPhone.slice(-10) }, // Match last 10 digits
          },
        });
        if (existingPatient) {
          patientId = existingPatient.id;
        }
      }

      // If still no match, create new patient
      if (!patientId && !leadId) {
        const newPatient = await prisma.patient.create({
          data: {
            organizationId: orgId,
            email: email?.toLowerCase() || null,
            phone: phone || null,
            firstName: firstName || 'Anonymous',
            lastName: lastName || 'User',
            source: contactType === 'whatsapp' ? 'whatsapp' : 'chatbot',
            patientStatus: 'NEW',
          },
        });
        patientId = newPatient.id;
      }
    }

    // Update conversation with patient/lead
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        ...(patientId && { patientId }),
        ...(leadId && { leadId }),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        lead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    // If patient, update their contact info
    if (patientId) {
      await prisma.patient.update({
        where: { id: patientId },
        data: {
          ...(email && { email: email.toLowerCase() }),
          ...(phone && { phone }),
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          lastContactedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      conversation: {
        id: updatedConversation.id,
        patientId: updatedConversation.patientId,
        leadId: updatedConversation.leadId,
        patient: updatedConversation.patient,
        lead: updatedConversation.lead,
        contactCollected: true,
        contactType,
      },
      exportReady: true,
      message: `Contact collected via ${contactType}. Ready to export conversation to ${contactType === 'email' ? email : phone}`,
    });
  } catch (error: any) {
    console.error('[Anonymous Contact] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to process contact' }, { status: 500 });
  }
}

/**
 * GET /api/conversations/anonymous-contact?conversationId=xxx
 * Check if conversation is ready for export (has email/phone)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        patient: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
        lead: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const contact = conversation.patient || conversation.lead;
    const hasEmail = !!contact?.email;
    const hasPhone = !!contact?.phone;

    return NextResponse.json({
      success: true,
      hasContact: hasEmail || hasPhone,
      contact: {
        email: contact?.email || null,
        phone: contact?.phone || null,
        name: contact ? `${contact.firstName} ${contact.lastName}`.trim() : null,
      },
      canExport: hasEmail || hasPhone,
      exportChannels: {
        email: hasEmail,
        whatsapp: hasPhone,
        pdf: true,
      },
    });
  } catch (error: any) {
    console.error('[Get Anonymous Contact] Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to check contact' }, { status: 500 });
  }
}
