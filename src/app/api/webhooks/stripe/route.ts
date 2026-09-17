import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    await prisma.organization.update({
      where: { stripeCustomerId: customerId },
      data: {
        plan: 'STARTER',
        stripeSubscriptionId: subscriptionId,
        conversationLimit: 200,
      },
    });
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;

    // stripeSubscriptionId is not @unique so we use findFirst + update
    const org = await prisma.organization.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (org) {
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          plan: 'FREE',
          conversationLimit: 50,
          stripeSubscriptionId: null,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}