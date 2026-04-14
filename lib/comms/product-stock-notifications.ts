import type { SupabaseClient } from "@supabase/supabase-js";

import { enqueueMessageWithClient } from "@/lib/comms/enqueue";

export type ProductStockScanRow = {
  id: string;
  user_id: string | null;
  product_name: string;
  status: string;
  expected_fulfillment_at: string | null;
  stock_notified_at: string | null;
};

/**
 * Richieste in attesa merce idonee all'accodamento automatico:
 * stato awaiting_stock, utente noto, nessuna notifica automatica già marcata,
 * e finestra temporale: nessuna data prevista oppure data prevista già passata (o oggi).
 */
export function isEligibleForStockArrivalNotification(row: ProductStockScanRow, now: Date): boolean {
  if (row.status !== "awaiting_stock") return false;
  if (!row.user_id?.trim()) return false;
  if (row.stock_notified_at != null) return false;
  if (!row.expected_fulfillment_at) return true;
  const expected = new Date(row.expected_fulfillment_at);
  if (Number.isNaN(expected.getTime())) return true;
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

/**
 * Accoda email `product_stock_available` per richieste awaiting_stock in finestra,
 * poi imposta `stock_notified_at` per evitare ri-accodamenti (l'outbox gestisce retry invio).
 */
export async function enqueueProductStockArrivalScan(
  supabase: SupabaseClient,
  options?: { now?: Date; limit?: number },
): Promise<{ scanned: number; enqueued: number; marked: number; errors: string[] }> {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? stockScanBatchLimitFromEnv();
  const errors: string[] = [];

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
    return { scanned: 0, enqueued: 0, marked: 0, errors };
  }

  const eligible = (rows ?? []).filter((r) =>
    isEligibleForStockArrivalNotification(r as ProductStockScanRow, now),
  );
  const slice = eligible.slice(0, limit);
  let enqueued = 0;
  let marked = 0;

  const notifiedAt = now.toISOString();

  for (const row of slice) {
    const r = row as ProductStockScanRow;
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

  return { scanned: slice.length, enqueued, marked, errors };
}
