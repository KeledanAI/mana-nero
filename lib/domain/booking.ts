import type { SupabaseClient } from "@supabase/supabase-js";

export type BookingOperation =
  | "book"
  | "cancel"
  | "staff_check_in"
  | "confirm_payment"
  | "expire_payment";

export type RunBookingActionParams = {
  eventId?: string | null;
  registrationId?: string | null;
  /** Stripe PaymentIntent id or Checkout Session payment_intent (confirm_payment only). */
  paymentIntentId?: string | null;
};

export async function runBookingAction(
  supabase: SupabaseClient,
  operation: BookingOperation,
  params: RunBookingActionParams,
) {
  const { data, error } = await supabase.rpc("event_registration_action", {
    p_operation: operation,
    p_event_id: params.eventId ?? null,
    p_registration_id: params.registrationId ?? null,
    p_payment_intent_id: params.paymentIntentId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as {
    ok?: boolean;
    status?: string;
    position?: number;
  };
}
