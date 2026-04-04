import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRole = "customer" | "staff" | "admin";

const rank: Record<AppRole, number> = {
  customer: 0,
  staff: 1,
  admin: 2,
};

/** Mirrors SQL `has_role(required)` hierarchy. */
export function userMeetsRole(
  userRole: AppRole | null | undefined,
  required: AppRole,
): boolean {
  if (!userRole) return false;
  return rank[userRole] >= rank[required];
}

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  marketing_consent: boolean;
  newsletter_opt_in: boolean;
  interests: string[] | null;
  telegram_username?: string | null;
  whatsapp_e164?: string | null;
};

export async function getProfileForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, role, marketing_consent, newsletter_opt_in, interests, telegram_username, whatsapp_e164",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as ProfileRow;
}
