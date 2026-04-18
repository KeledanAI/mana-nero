import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileSearchResult = {
  id: string;
  full_name: string | null;
  email: string | null;
  external_handles: Array<{ platform: string; external_id: string; external_username: string | null }>;
};

/**
 * Cerca profili Mana Nero per sostegno al picker di import.
 * - Match case-insensitive su full_name, email, telegram_username.
 * - Ritorna max `limit` risultati con fino a 5 identità esterne ciascuno per
 *   far disambiguare lo staff in UI ("Mario Rossi · DCI 1234567 · IG @rossi").
 *
 * Sicurezza: si appoggia alle RLS di `profiles` e `player_external_identities`
 * (entrambe richiedono `staff` per leggere altrui). Nessun cast service-role.
 */
export async function searchProfiles(
  supabase: SupabaseClient,
  query: string,
  limit = 8,
): Promise<ProfileSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const safeLimit = Math.max(1, Math.min(limit, 25));
  const escaped = trimmed.replace(/[%,]/g, " ").trim();
  if (!escaped) return [];
  const pattern = `%${escaped}%`;

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, telegram_username")
    .or(
      `full_name.ilike.${pattern},email.ilike.${pattern},telegram_username.ilike.${pattern}`,
    )
    .limit(safeLimit);

  if (error) {
    throw new Error(error.message);
  }

  const profileRows = (profiles ?? []) as Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    telegram_username: string | null;
  }>;

  if (profileRows.length === 0) return [];

  const ids = profileRows.map((p) => p.id);
  const { data: identities } = await supabase
    .from("player_external_identities")
    .select("profile_id, platform, external_id, external_username")
    .in("profile_id", ids);

  const identitiesByProfile = new Map<string, ProfileSearchResult["external_handles"]>();
  for (const row of (identities ?? []) as Array<Record<string, unknown>>) {
    const pid = String(row.profile_id);
    const list = identitiesByProfile.get(pid) ?? [];
    if (list.length < 5) {
      list.push({
        platform: String(row.platform),
        external_id: String(row.external_id ?? ""),
        external_username: (row.external_username as string | null) ?? null,
      });
    }
    identitiesByProfile.set(pid, list);
  }

  return profileRows.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    external_handles: identitiesByProfile.get(p.id) ?? [],
  }));
}
