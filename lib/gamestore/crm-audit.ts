import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffCrmAuditPayload = {
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  payload?: Record<string, unknown>;
};

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
