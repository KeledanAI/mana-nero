import type { SupabaseClient } from "@supabase/supabase-js";

export const EXTERNAL_PLATFORMS = [
  "wizards_companion",
  "bandai_tcg_plus",
  "play_pokemon",
  "world_beyblade_organization",
  "spicerack",
  "melee_gg",
  "discord",
  "telegram",
  "twitch",
  "instagram",
] as const;

export type ExternalPlatform = (typeof EXTERNAL_PLATFORMS)[number];

export const PLATFORM_LABELS: Record<ExternalPlatform, string> = {
  wizards_companion: "Wizards Companion (DCI)",
  bandai_tcg_plus: "Bandai TCG+ (BNID)",
  play_pokemon: "Play! Pokémon ID",
  world_beyblade_organization: "World Beyblade Organization",
  spicerack: "Spicerack",
  melee_gg: "Melee.gg",
  discord: "Discord",
  telegram: "Telegram",
  twitch: "Twitch",
  instagram: "Instagram",
};

export function isExternalPlatform(value: string): value is ExternalPlatform {
  return (EXTERNAL_PLATFORMS as readonly string[]).includes(value);
}

export type LinkExternalIdentityInput = {
  profileId: string;
  platform: string;
  externalId?: string | null;
  externalUsername?: string | null;
  notes?: string | null;
};

export type ExternalIdentityRow = {
  id: string;
  profile_id: string;
  platform: ExternalPlatform;
  external_id: string;
  external_username: string | null;
  verified: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Crea o aggiorna l'identità esterna del proprietario corrente (RLS).
 * Lo staff può forzare il flag `verified` con `setVerifiedExternalIdentity`.
 */
export async function upsertOwnExternalIdentity(
  supabase: SupabaseClient,
  input: LinkExternalIdentityInput,
): Promise<ExternalIdentityRow> {
  if (!input.profileId) {
    throw new Error("profile_id_required");
  }
  if (!isExternalPlatform(input.platform)) {
    throw new Error(`platform_not_supported:${input.platform}`);
  }

  const externalId = (input.externalId ?? "").trim();
  const externalUsername = (input.externalUsername ?? "").trim();

  if (!externalId && !externalUsername) {
    throw new Error("identity_required_id_or_username");
  }

  const payload = {
    profile_id: input.profileId,
    platform: input.platform,
    external_id: externalId,
    external_username: externalUsername || null,
    notes: input.notes?.trim() || null,
  };

  const { data, error } = await supabase
    .from("player_external_identities")
    .upsert(payload, { onConflict: "profile_id,platform" })
    .select(
      "id, profile_id, platform, external_id, external_username, verified, notes, created_at, updated_at",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ExternalIdentityRow;
}

export async function deleteOwnExternalIdentity(
  supabase: SupabaseClient,
  identityId: string,
): Promise<void> {
  if (!identityId) throw new Error("identity_id_required");

  const { error } = await supabase
    .from("player_external_identities")
    .delete()
    .eq("id", identityId);

  if (error) throw new Error(error.message);
}

export type TournamentResultInput = {
  eventId: string;
  profileId?: string | null;
  displayName: string;
  externalHandle?: string | null;
  format?: string | null;
  finalRank: number;
  wins?: number;
  losses?: number;
  draws?: number;
  points?: number;
  meta?: Record<string, unknown> | null;
  recordedBy?: string | null;
};

export type TournamentResultRow = {
  id: string;
  event_id: string;
  profile_id: string | null;
  display_name: string;
  external_handle: string | null;
  format: string | null;
  final_rank: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  meta: Record<string, unknown>;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Calcola un punteggio normalizzato (0-1) coerente fra giochi diversi.
 * Lo staff può sempre sovrascrivere con `points` esplicito.
 */
export function defaultPointsForRank(
  finalRank: number,
  totalParticipants: number,
): number {
  if (!Number.isFinite(finalRank) || finalRank < 1) return 0;
  if (!Number.isFinite(totalParticipants) || totalParticipants < 1) return 0;
  if (totalParticipants === 1) return 1;
  const clampedRank = Math.min(Math.max(Math.trunc(finalRank), 1), totalParticipants);
  const ratio = (totalParticipants - clampedRank) / (totalParticipants - 1);
  return Math.round(ratio * 100) / 100;
}

/**
 * Inserisce o aggiorna un risultato torneo (solo staff via RLS).
 * Le UNIQUE index (event_id, profile_id) e (event_id, lower(display_name) WHERE walk-in)
 * garantiscono che non si possa registrare lo stesso giocatore due volte sullo stesso evento.
 */
export async function recordTournamentResult(
  supabase: SupabaseClient,
  input: TournamentResultInput,
): Promise<TournamentResultRow> {
  if (!input.eventId) throw new Error("event_id_required");
  const displayName = (input.displayName ?? "").trim();
  if (!displayName) throw new Error("display_name_required");
  if (!Number.isFinite(input.finalRank) || input.finalRank < 1) {
    throw new Error("final_rank_invalid");
  }

  const payload = {
    event_id: input.eventId,
    profile_id: input.profileId ?? null,
    display_name: displayName,
    external_handle: input.externalHandle?.trim() || null,
    format: input.format?.trim() || null,
    final_rank: Math.trunc(input.finalRank),
    wins: clampNonNegativeInt(input.wins),
    losses: clampNonNegativeInt(input.losses),
    draws: clampNonNegativeInt(input.draws),
    points: typeof input.points === "number" && input.points >= 0 ? roundCents(input.points) : 0,
    meta: input.meta ?? {},
    recorded_by: input.recordedBy ?? null,
  };

  const onConflict = payload.profile_id
    ? "event_id,profile_id"
    : undefined;

  const query = supabase
    .from("tournament_results")
    .upsert(payload, onConflict ? { onConflict } : undefined)
    .select(
      "id, event_id, profile_id, display_name, external_handle, format, final_rank, wins, losses, draws, points, meta, recorded_by, created_at, updated_at",
    )
    .single();

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return normalizeResult(data);
}

export async function deleteTournamentResult(
  supabase: SupabaseClient,
  resultId: string,
): Promise<void> {
  if (!resultId) throw new Error("result_id_required");
  const { error } = await supabase
    .from("tournament_results")
    .delete()
    .eq("id", resultId);
  if (error) throw new Error(error.message);
}

export type LocalRankingRow = {
  player_key: string;
  display_name: string;
  profile_id: string | null;
  events_played: number;
  total_points: number;
  best_finish: number;
  last_event_at: string | null;
};

export async function fetchLocalRanking(
  supabase: SupabaseClient,
  gameSlug: string,
  limit = 50,
): Promise<LocalRankingRow[]> {
  if (!gameSlug) return [];
  const { data, error } = await supabase.rpc("local_player_ranking", {
    p_game_slug: gameSlug,
    p_limit: limit,
  });
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    player_key: String(row.player_key),
    display_name: String(row.display_name ?? ""),
    profile_id: (row.profile_id as string | null) ?? null,
    events_played: Number(row.events_played ?? 0),
    total_points: Number(row.total_points ?? 0),
    best_finish: Number(row.best_finish ?? 0),
    last_event_at: (row.last_event_at as string | null) ?? null,
  }));
}

export type LocalRankingSummary = {
  total_players: number;
  total_results: number;
  last_event_at: string | null;
};

export async function fetchLocalRankingSummary(
  supabase: SupabaseClient,
  gameSlug: string,
): Promise<LocalRankingSummary> {
  const empty: LocalRankingSummary = {
    total_players: 0,
    total_results: 0,
    last_event_at: null,
  };
  if (!gameSlug) return empty;
  const { data, error } = await supabase.rpc("local_ranking_summary", {
    p_game_slug: gameSlug,
  });
  if (error) {
    throw new Error(error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return empty;
  const r = row as Record<string, unknown>;
  return {
    total_players: Number(r.total_players ?? 0),
    total_results: Number(r.total_results ?? 0),
    last_event_at: (r.last_event_at as string | null) ?? null,
  };
}

function clampNonNegativeInt(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.trunc(value);
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeResult(data: unknown): TournamentResultRow {
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    event_id: String(row.event_id),
    profile_id: (row.profile_id as string | null) ?? null,
    display_name: String(row.display_name ?? ""),
    external_handle: (row.external_handle as string | null) ?? null,
    format: (row.format as string | null) ?? null,
    final_rank: Number(row.final_rank ?? 0),
    wins: Number(row.wins ?? 0),
    losses: Number(row.losses ?? 0),
    draws: Number(row.draws ?? 0),
    points: Number(row.points ?? 0),
    meta: (row.meta as Record<string, unknown>) ?? {},
    recorded_by: (row.recorded_by as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}
