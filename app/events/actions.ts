"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runBookingAction } from "@/lib/domain/booking";
import { getEventBySlug } from "@/lib/gamestore/data";
import {
  eventCheckoutAmountCents,
  eventRequiresOnlinePayment,
  stripeCurrency,
} from "@/lib/payments/event-checkout";
import { getStripeServer } from "@/lib/payments/stripe-server";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

async function mutateRegistration(
  operation: "book" | "cancel",
  formData: FormData,
) {
  const eventId = String(formData.get("event_id") || "");
  if (!eventId) redirect("/events?error=event_id_required");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  let result: { status?: string } | undefined;
  let errorMessage: string | undefined;

  try {
    result = await runBookingAction(supabase, operation, {
      eventId,
      registrationId: null,
    });
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "booking_failed";
  }

  revalidatePath("/events");
  revalidatePath("/protected");

  if (errorMessage) {
    redirect(`/events?error=${encodeURIComponent(errorMessage)}`);
  }

  const status =
    typeof result?.status === "string" ? result.status : operation;
  redirect(`/events?success=${encodeURIComponent(status)}`);
}

export async function bookEvent(formData: FormData) {
  await mutateRegistration("book", formData);
}

export async function cancelEventBooking(formData: FormData) {
  await mutateRegistration("cancel", formData);
}

export async function startEventPaymentCheckout(formData: FormData) {
  const registrationId = String(formData.get("registration_id") || "").trim();
  const slug = String(formData.get("event_slug") || "").trim();
  if (!registrationId || !slug) {
    redirect("/events?error=missing_checkout_params");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const event = await getEventBySlug(supabase, slug);
  if (!event || event.slug !== slug) redirect("/events?error=event_not_found");

  const { data: reg, error: regErr } = await supabase
    .from("event_registrations")
    .select("id, status, event_id")
    .eq("id", registrationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (regErr || !reg || reg.event_id !== event.id || reg.status !== "pending_payment") {
    redirect(`/events/${encodeURIComponent(event.slug)}?error=checkout_not_allowed`);
  }

  if (!eventRequiresOnlinePayment(event)) {
    redirect(`/events/${encodeURIComponent(event.slug)}?error=event_not_paid`);
  }

  const amount = eventCheckoutAmountCents(event);
  if (amount < 50) {
    redirect(`/events/${encodeURIComponent(event.slug)}?error=amount_too_low`);
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    redirect(`/events/${encodeURIComponent(event.slug)}?error=stripe_not_configured`);
  }

  const origin = getSiteUrl();
  const stripe = getStripeServer();
  const currency = stripeCurrency(event);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency,
          unit_amount: amount,
          product_data: {
            name: event.title,
            description: event.price_display ?? undefined,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/events/${encodeURIComponent(event.slug)}?payment=success`,
    cancel_url: `${origin}/events/${encodeURIComponent(event.slug)}?payment=cancelled`,
    metadata: {
      registration_id: registrationId,
      event_id: event.id,
      user_id: user.id,
    },
    customer_email: user.email ?? undefined,
  });

  if (!session.url) {
    redirect(`/events/${encodeURIComponent(event.slug)}?error=checkout_session_failed`);
  }

  redirect(session.url);
}
