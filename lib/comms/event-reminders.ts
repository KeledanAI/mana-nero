import { enqueueMessageWithClient } from "@/lib/comms/enqueue";
import { createAdminClient } from "@/lib/supabase/admin";

const REMINDER_REGISTRATION_STATUSES = [
  "confirmed",
  "waitlisted",
  "pending_payment",
] as const;

/** Finestra ~24h prima dell’evento (22h–30h) per tollerare intervalli cron di 6h; idempotenza evita doppi invii. */
export function eventReminder24hWindowIso(nowMs = Date.now()) {
  const lower = new Date(nowMs + 22 * 60 * 60 * 1000).toISOString();
  const upper = new Date(nowMs + 30 * 60 * 60 * 1000).toISOString();
  return { lower, upper };
}

export type EventReminder24hScanResult = {
  eventsScanned: number;
  remindersAttempted: number;
};

/**
 * Accoda email reminder 24h per eventi published nella finestra temporale.
 * Usa service role (insert outbox non consentito ai JWT staff).
 */
export async function enqueueEventReminder24hScan(): Promise<EventReminder24hScanResult> {
  const admin = createAdminClient();
  const { lower, upper } = eventReminder24hWindowIso();

  const { data: events, error: evErr } = await admin
    .from("events")
    .select("id")
    .eq("status", "published")
    .gte("starts_at", lower)
    .lte("starts_at", upper);

  if (evErr) {
    throw new Error(evErr.message);
  }

  const eventRows = events ?? [];
  let remindersAttempted = 0;

  for (const ev of eventRows) {
    const { data: regs, error: rErr } = await admin
      .from("event_registrations")
      .select("user_id, event_id")
      .eq("event_id", ev.id)
      .in("status", [...REMINDER_REGISTRATION_STATUSES]);

    if (rErr) {
      continue;
    }

    for (const reg of regs ?? []) {
      const userId = reg.user_id as string | null;
      if (!userId) continue;

      const idempotencyKey = `event_reminder_24h:${ev.id}:${userId}`;
      await enqueueMessageWithClient(admin, {
        idempotencyKey,
        channel: "email",
        payload: {
          kind: "event_reminder_24h",
          event_id: ev.id,
          user_id: userId,
        },
        scheduledAt: new Date().toISOString(),
      });
      remindersAttempted += 1;
    }
  }

  return { eventsScanned: eventRows.length, remindersAttempted };
}
