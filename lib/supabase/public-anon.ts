import { createClient } from "@supabase/supabase-js";

import { getSupabaseAnonKey } from "@/lib/supabase/env";

/**
 * Client Supabase anon senza sessione (RPC pubblici come check-in da token).
 */
export function createPublicAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = getSupabaseAnonKey()?.trim();
  if (!url || !key) {
    throw new Error("missing_supabase_public_env");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
