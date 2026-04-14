import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Expires stale pending_payment registrations via RPC (waitlist promotion inside DB).
 */
export async function expireStalePendingEventRegistrations(
  limit = 40,
): Promise<{ expired: number; errors: number }> {
  const admin = createAdminClient();
  const hoursRaw = process.env.EVENT_PAYMENT_PENDING_EXPIRE_HOURS?.trim();
  const hours = Math.max(1, Number.parseInt(hoursRaw || "24", 10) || 24);
  const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();

  const { data, error } = await admin
    .from("event_registrations")
    .select("id")
    .eq("status", "pending_payment")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  let expired = 0;
  let errors = 0;

  for (const row of data ?? []) {
    const { error: rpcErr } = await admin.rpc("event_registration_action", {
      p_operation: "expire_payment",
      p_event_id: null,
      p_registration_id: row.id,
      p_payment_intent_id: null,
    });
    if (rpcErr) {
      errors += 1;
    } else {
      expired += 1;
    }
  }

  return { expired, errors };
}
