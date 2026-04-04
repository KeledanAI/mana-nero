"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runBookingAction } from "@/lib/domain/booking";
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
