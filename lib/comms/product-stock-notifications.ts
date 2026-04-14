import type { SupabaseClient } from "@supabase/supabase-js";

import { enqueueMessageWithClient } from "@/lib/comms/enqueue";

export type ProductStockScanRow = {
  id: string;
  user_id: string | null;
  product_name: string;
  status: string;
  expected_fulfillment_at: string | null;
  stock_notified_at: string | null;
  /** Da join `profiles`; se valorizzato (1–730) sostituisce l’env globale per la finestra su `expected_fulfillment_at`. */
  profile_stock_lookahead_days?: number | null;
};

/**
 * Se impostato, consente anche richieste con `expected_fulfillment_at` nel futuro prossimo
 * (entro N giorni da `now`), oltre a data assente o già passata.
 */
export function stockExpectedLookaheadDaysFromEnv(): number | null {
  const raw = (process.env.PRODUCT_STOCK_EXPECTED_LOOKAHEAD_DAYS ?? "").trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, 730);
}

/**
 * Se impostato, il cron stock può impostare `cancelled` sulle richieste `awaiting_stock`
 * con `expected_fulfillment_at` più vecchia di N giorni rispetto a `now` (preordini abbandonati).
 */
export function stockAutoCancelGraceDaysFromEnv(): number | null {
  const raw = (process.env.PRODUCT_STOCK_AUTO_CANCEL_GRACE_DAYS ?? "").trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, 3650);
}

/**
 * Aggiorna in batch richieste `awaiting_stock` obsolete (vedi env grace days).
 */
export async function autoCancelStaleAwaitingStockRequests(
  supabase: SupabaseClient,
  options?: { now?: Date },
): Promise<{ cancelled: number; errors: string[] }> {
  const days = stockAutoCancelGraceDaysFromEnv();
  const errors: string[] = [];
  if (days == null) {
    return { cancelled: 0, errors };
  }
  const now = options?.now ?? new Date();
  const cutoffMs = now.getTime() - days * 86400000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const { data, error } = await supabase
    .from("product_reservation_requests")
    .update({ status: "cancelled", updated_at: now.toISOString() })
    .eq("status", "awaiting_stock")
    .not("expected_fulfillment_at", "is", null)
    .lt("expected_fulfillment_at", cutoffIso)
    .select("id");

  if (error) {
    errors.push(error.message);
    return { cancelled: 0, errors };
  }
  return { cancelled: (data ?? []).length, errors };
}

/**
 * Richieste in attesa merce idonee all'accodamento automatico:
 * stato awaiting_stock, utente noto, nessuna notifica automatica già marcata,
 * e finestra temporale: nessuna data prevista, data prevista già passata, oppure (se
 * `lookaheadDays`) data prevista entro i prossimi N giorni da `now`.
 */
export function isEligibleForStockArrivalNotification(
  row: ProductStockScanRow,
  now: Date,
  lookaheadDays?: number | null,
): boolean {
  if (row.status !== "awaiting_stock") return false;
  if (!row.user_id?.trim()) return false;
  if (row.stock_notified_at != null) return false;
  if (!row.expected_fulfillment_at) return true;
  const expected = new Date(row.expected_fulfillment_at);
  if (Number.isNaN(expected.getTime())) return true;
  const perProfile =
    row.profile_stock_lookahead_days != null &&
    row.profile_stock_lookahead_days >= 1 &&
    row.profile_stock_lookahead_days <= 730
      ? row.profile_stock_lookahead_days
      : null;
  const windowDays = perProfile ?? lookaheadDays;
  if (windowDays != null) {
    const horizon = new Date(now.getTime() + windowDays * 86400000);
    return expected.getTime() <= horizon.getTime();
  }
  return expected.getTime() <= now.getTime();
}

export function stockArrivalIdempotencyKey(requestId: string): string {
  return `product_stock_arrival:${requestId}`;
}

/** Limite righe processate per cron (override con PRODUCT_STOCK_SCAN_BATCH_LIMIT). */
export function stockScanBatchLimitFromEnv(): number {
  const raw = (process.env.PRODUCT_STOCK_SCAN_BATCH_LIMIT ?? "").trim();
  if (!raw) return 40;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 40;
  return Math.min(n, 500);
}

/** Una riga digest staff per fascia oraria UTC (idempotency outbox). */
export function staffStockSummaryIdempotencyKey(now: Date): string {
  return `product_stock_staff_summary:${now.toISOString().slice(0, 13)}`;
}

/**
 * Accoda email `product_stock_available` per richieste awaiting_stock in finestra,
 * poi imposta `stock_notified_at` per evitare ri-accodamenti (l'outbox gestisce retry invio).
 */
export async function enqueueProductStockArrivalScan(
  supabase: SupabaseClient,
  options?: { now?: Date; limit?: number },
): Promise<{
  scanned: number;
  enqueued: number;
  marked: number;
  auto_cancelled: number;
  errors: string[];
}> {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? stockScanBatchLimitFromEnv();
  const lookaheadDays = stockExpectedLookaheadDaysFromEnv();
  const errors: string[] = [];

  const auto = await autoCancelStaleAwaitingStockRequests(supabase, { now });
  errors.push(...auto.errors);

  const { data: rows, error: listErr } = await supabase
    .from("product_reservation_requests")
    .select("id, user_id, product_name, status, expected_fulfillment_at, stock_notified_at")
    .eq("status", "awaiting_stock")
    .is("stock_notified_at", null)
    .not("user_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(limit * 2);

  if (listErr) {
    errors.push(listErr.message);
    return { scanned: 0, enqueued: 0, marked: 0, auto_cancelled: auto.cancelled, errors };
  }

  const userIds = [...new Set((rows ?? []).map((r) => r.user_id as string | null).filter(Boolean))] as string[];
  const lookaheadByUser = new Map<string, number | null>();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, stock_notification_lookahead_days")
      .in("id", userIds);
    for (const p of profs ?? []) {
      lookaheadByUser.set(
        p.id as string,
        (p as { stock_notification_lookahead_days?: number | null }).stock_notification_lookahead_days ?? null,
      );
    }
  }

  const flatRows: ProductStockScanRow[] = (rows ?? []).map((r) => {
    const row = r as ProductStockScanRow;
    return {
      ...row,
      profile_stock_lookahead_days: row.user_id ? lookaheadByUser.get(row.user_id) ?? null : null,
    };
  });

  const eligible = flatRows.filter((r) =>
    isEligibleForStockArrivalNotification(r, now, lookaheadDays),
  );
  const slice = eligible.slice(0, limit);
  let enqueued = 0;
  let marked = 0;

  const notifiedAt = now.toISOString();

  for (const row of slice) {
    const r = row;
    const idempotencyKey = stockArrivalIdempotencyKey(r.id);
    try {
      await enqueueMessageWithClient(supabase, {
        idempotencyKey,
        channel: "email",
        payload: {
          kind: "product_stock_available",
          user_id: r.user_id,
          product_request_id: r.id,
          product_name: r.product_name,
        },
      });
      enqueued += 1;
    } catch (e) {
      errors.push(`${r.id}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    const { error: updErr } = await supabase
      .from("product_reservation_requests")
      .update({ stock_notified_at: notifiedAt, updated_at: notifiedAt })
      .eq("id", r.id)
      .is("stock_notified_at", null);

    if (updErr) {
      errors.push(`${r.id} mark: ${updErr.message}`);
    } else {
      marked += 1;
    }
  }

  const staffDigestTo = (process.env.PRODUCT_STOCK_STAFF_SUMMARY_EMAIL ?? "").trim();
  if (staffDigestTo.includes("@") && enqueued > 0) {
    try {
      const lines = slice.map(
        (row) =>
          `- ${(row as ProductStockScanRow).product_name} (${(row as ProductStockScanRow).id.slice(0, 8)}…)`,
      );
      await enqueueMessageWithClient(supabase, {
        idempotencyKey: staffStockSummaryIdempotencyKey(now),
        channel: "email",
        payload: {
          kind: "product_stock_staff_summary",
          staff_email: staffDigestTo,
          enqueued,
          marked,
          lines,
        },
      });
    } catch (e) {
      errors.push(
        `staff_summary: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return { scanned: slice.length, enqueued, marked, auto_cancelled: auto.cancelled, errors };
}
