import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffCrmAuditPayload = {
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  payload?: Record<string, unknown>;
};

/**
 * Convenzione `action_type` (estendere in modo additivo; allineare payload a timeline CRM):
 * - `customer_profile_updated` — salvataggio scheda; può includere `outbox_*_pending_cancelled` se consensi disattivati.
 * - `marketing_consent_revoked` / `newsletter_opt_in_revoked` — revoche dedicate + conteggi outbox campagna.
 * - `campaign_segment_enqueued`, `comms_campaign_record_saved`, `staff_check_in`, `rotate_check_in_token`, ecc. (vedi `app/admin/actions.ts`).
 * Annullamenti outbox lato worker (`cancelled`, `OUTBOX_SKIP:*`) restano su `communication_outbox.last_error`, non su questa tabella.
 */

/**
 * Best-effort audit CRM (RLS: actor deve essere la sessione corrente).
 * Non blocca il flusso chiamante in caso di errore insert.
 */
export async function logStaffCrmAction(
  supabase: SupabaseClient,
  actorId: string,
  row: StaffCrmAuditPayload,
): Promise<void> {
  const { error } = await supabase.from("staff_crm_audit_log").insert({
    actor_id: actorId,
    action_type: row.action_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    payload: row.payload ?? {},
  });
  if (error) {
    return;
  }
}
