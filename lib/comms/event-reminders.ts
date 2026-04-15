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

const SEVEN_D_MS = 7 * 24 * 60 * 60 * 1000;

/** Finestra ~7 giorni prima dell’evento (±4h) per tollerare cron ogni 6h; idempotenza separata da `event_reminder_24h`. */
export function eventReminder7dWindowIso(nowMs = Date.now()) {
  const lower = new Date(nowMs + SEVEN_D_MS - 4 * 60 * 60 * 1000).toISOString();
  const upper = new Date(nowMs + SEVEN_D_MS + 4 * 60 * 60 * 1000).toISOString();
  return { lower, upper };
}

export type EventReminder24hScanResult = {
  eventsScanned: number;
  remindersAttempted: number;
};

export type EventReminder7dScanResult = {
  eventsScanned: number;
  remindersAttempted: number;
};

type ReminderPayloadKind = "event_reminder_24h" | "event_reminder_7d";

async function enqueueRemindersInWindow(
  lower: string,
  upper: string,
  payloadKind: ReminderPayloadKind,
): Promise<{ eventsScanned: number; remindersAttempted: number }> {
  const admin = createAdminClient();

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

      const idempotencyKey = `${payloadKind}:${ev.id}:${userId}`;
      await enqueueMessageWithClient(admin, {
        idempotencyKey,
        channel: "email",
        payload: {
          kind: payloadKind,
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

/**
 * Accoda email reminder 24h per eventi published nella finestra temporale.
 * Usa service role (insert outbox non consentito ai JWT staff).
 */
export async function enqueueEventReminder24hScan(): Promise<EventReminder24hScanResult> {
  const { lower, upper } = eventReminder24hWindowIso();
  return enqueueRemindersInWindow(lower, upper, "event_reminder_24h");
}

/**
 * Accoda email reminder ~7 giorni prima degli eventi published nella finestra temporale.
 * Stessa semantica iscrizioni del 24h; idempotency distinta (`event_reminder_7d:…`).
 */
export async function enqueueEventReminder7dScan(): Promise<EventReminder7dScanResult> {
  const { lower, upper } = eventReminder7dWindowIso();
  return enqueueRemindersInWindow(lower, upper, "event_reminder_7d");
}

export type EventRemindersCronScanResult = {
  reminder24h: EventReminder24hScanResult;
  reminder7d: EventReminder7dScanResult;
};

/** Esegue entrambi gli scan (cron e azione staff); somme utili per metriche aggregate. */
export async function enqueueEventReminderScansCombined(): Promise<EventRemindersCronScanResult> {
  const [reminder24h, reminder7d] = await Promise.all([
    enqueueEventReminder24hScan(),
    enqueueEventReminder7dScan(),
  ]);
  return { reminder24h, reminder7d };
}
