import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildReminderPayload } from "@/lib/comms/outbox-dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

import { loadEnvLocal } from "./_load-env-local";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

type ReminderSlot = {
  kind: "event_reminder_24h" | "event_reminder_2h";
  hoursBefore: number;
};

const reminderSlots: ReminderSlot[] = [
  { kind: "event_reminder_24h", hoursBefore: 24 },
  { kind: "event_reminder_2h", hoursBefore: 2 },
];

function isoShift(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function scheduleForSlot(
  kind: ReminderSlot["kind"],
  startsAtFrom: string,
  startsAtTo: string,
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_registrations")
    .select("id, event_id, user_id, status, events!inner(id, starts_at, status)")
    .eq("status", "confirmed")
    .eq("events.status", "published")
    .gte("events.starts_at", startsAtFrom)
    .lt("events.starts_at", startsAtTo);

  if (error) {
    throw new Error(error.message);
  }

  let scheduled = 0;

  for (const row of data ?? []) {
    const registration = row as {
      id: string;
      event_id: string;
      user_id: string;
    };

    const idempotencyKey = `${kind}:${registration.event_id}:${registration.user_id}`;
    const payload = buildReminderPayload(kind, {
      eventId: registration.event_id,
      userId: registration.user_id,
      registrationId: registration.id,
    });

    const { error: insertError } = await supabase
      .from("communication_outbox")
      .upsert(
        {
          idempotency_key: idempotencyKey,
          channel: "email",
          payload,
          status: "pending",
          scheduled_at: new Date().toISOString(),
        },
        {
          onConflict: "idempotency_key",
          ignoreDuplicates: true,
        },
      );

    if (insertError) {
      throw new Error(insertError.message);
    }

    scheduled += 1;
  }

  return scheduled;
}

export async function scheduleEventReminders() {
  const toleranceMinutes = Number.parseInt(
    process.env.REMINDER_WINDOW_MINUTES || "90",
    10,
  );
  const toleranceHours = (Number.isFinite(toleranceMinutes) ? toleranceMinutes : 90) / 60 / 2;

  const result: Record<string, number> = {};

  for (const slot of reminderSlots) {
    const from = isoShift(slot.hoursBefore - toleranceHours);
    const to = isoShift(slot.hoursBefore + toleranceHours);
    result[slot.kind] = await scheduleForSlot(slot.kind, from, to);
  }

  return result;
}

async function main() {
  loadEnvLocal(root);
  const result = await scheduleEventReminders();
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
