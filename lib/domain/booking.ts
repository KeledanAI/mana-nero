import type { SupabaseClient } from "@supabase/supabase-js";

export type BookingOperation = "book" | "cancel" | "staff_check_in";

export async function runBookingAction(
  supabase: SupabaseClient,
  operation: BookingOperation,
  params: { eventId?: string | null; registrationId?: string | null },
) {
  const { data, error } = await supabase.rpc("event_registration_action", {
    p_operation: operation,
    p_event_id: params.eventId ?? null,
    p_registration_id: params.registrationId ?? null,
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
