import { createAdminClient } from "@/lib/supabase/admin";

import { dispatchOutboxMessage } from "@/lib/comms/outbox-dispatch";
import type { OutboxRow } from "@/lib/comms/outbox-types";

type ProcessOutboxOptions = {
  batchSize?: number;
  maxAttempts?: number;
};

function nextRetryIso(attemptCount: number) {
  const backoffMinutes = Math.min(60, Math.max(5, attemptCount * 5));
  return new Date(Date.now() + backoffMinutes * 60_000).toISOString();
}

async function markProcessing(rowId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("communication_outbox")
    .update({
      status: "processing",
      updated_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", rowId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.id);
}

export async function processOutbox(options: ProcessOutboxOptions = {}) {
  const batchSize = options.batchSize ?? 20;
  const maxAttempts = options.maxAttempts ?? 5;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("communication_outbox")
    .select(
      "id, idempotency_key, channel, payload, status, scheduled_at, attempt_count, last_error, created_at, updated_at",
    )
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as OutboxRow[];
  const summary = {
    scanned: rows.length,
    sent: 0,
    deferred: 0,
    failed: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const locked = await markProcessing(row.id);
    if (!locked) {
      summary.skipped += 1;
      continue;
    }

    try {
      const result = await dispatchOutboxMessage(supabase, row);
      const { error: updateError } = await supabase
        .from("communication_outbox")
        .update({
          status: "sent",
          attempt_count: row.attempt_count + 1,
          last_error: result.transportId
            ? `sent:${result.transport}:${result.transportId}`
            : `sent:${result.transport}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      summary.sent += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "outbox_dispatch_failed";
      const nextAttempt = row.attempt_count + 1;
      const terminal = nextAttempt >= maxAttempts;

      const { error: updateError } = await supabase
        .from("communication_outbox")
        .update({
          status: terminal ? "failed" : "pending",
          attempt_count: nextAttempt,
          last_error: message,
          scheduled_at: terminal ? row.scheduled_at : nextRetryIso(nextAttempt),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (terminal) {
        summary.failed += 1;
      } else {
        summary.deferred += 1;
      }
    }
  }

  return summary;
}
