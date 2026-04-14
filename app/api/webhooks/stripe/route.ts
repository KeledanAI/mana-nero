import { NextResponse } from "next/server";
import Stripe from "stripe";

import { runBookingAction } from "@/lib/domain/booking";
import { getStripeServer } from "@/lib/payments/stripe-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const sig = request.headers.get("stripe-signature");
  if (!secret || !sig) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET or signature missing" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    const stripe = getStripeServer();
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const registrationId = session.metadata?.registration_id?.trim();
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent && typeof session.payment_intent === "object"
          ? session.payment_intent.id
          : null;

    if (!registrationId) {
      return NextResponse.json(
        { error: "missing registration_id in metadata" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    try {
      await runBookingAction(admin, "confirm_payment", {
        registrationId,
        paymentIntentId,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
