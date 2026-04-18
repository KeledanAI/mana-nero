import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type CsvImportSource,
  type ParsedTournamentRow,
} from "@/lib/imports/tournament-results-csv";
import {
  defaultPointsForRank,
  recordTournamentResult,
  type ExternalPlatform,
} from "@/lib/domain/tournaments";

/**
 * Mappa dalla source CSV alle piattaforme `player_external_identities`
 * compatibili per l'auto-link. `generic` cerca su tutte le piattaforme con
 * external_id non vuoto.
 */
const SOURCE_TO_PLATFORMS: Record<CsvImportSource, ExternalPlatform[]> = {
  wizards_eventlink: ["wizards_companion"],
  play_pokemon: ["play_pokemon"],
  bandai_tcg_plus: ["bandai_tcg_plus"],
  generic: [
    "wizards_companion",
    "play_pokemon",
    "bandai_tcg_plus",
    "world_beyblade_organization",
    "spicerack",
    "melee_gg",
  ],
};

export type PreviewRow = ParsedTournamentRow & {
  /** Profilo Mana Nero a cui collegare automaticamente (lookup external identity). */
  proposed_profile_id: string | null;
  proposed_profile_label: string | null;
  /** Punti effettivi che verranno scritti (override CSV oppure default normalizzato). */
  resolved_points: number;
};

export type ImportPreview = {
  rows: PreviewRow[];
  auto_link_count: number;
  walk_in_count: number;
  total_participants: number;
};

/**
 * Per ogni riga parseata cerca un profilo collegato via external_handle.
 * Lookup batched: due query (external_id, external_username) sulle piattaforme
 * compatibili con la source.
 */
export async function previewImport(
  supabase: SupabaseClient,
  source: CsvImportSource,
  parsedRows: ParsedTournamentRow[],
): Promise<ImportPreview> {
  const handles = parsedRows
    .map((r) => (r.external_handle ?? "").trim())
    .filter((v) => v.length > 0);
  const uniqueHandles = [...new Set(handles)];
  const platforms = SOURCE_TO_PLATFORMS[source];

  const handleToProfile = new Map<string, { profile_id: string; label: string | null }>();

  if (uniqueHandles.length > 0 && platforms.length > 0) {
    const [byId, byUsername] = await Promise.all([
      supabase
        .from("player_external_identities")
        .select("profile_id, external_id, external_username, platform")
        .in("platform", platforms)
        .in("external_id", uniqueHandles),
      supabase
        .from("player_external_identities")
        .select("profile_id, external_id, external_username, platform")
        .in("platform", platforms)
        .in("external_username", uniqueHandles),
    ]);

    const profileIds = new Set<string>();
    const matches: Array<{
      profile_id: string;
      external_id: string | null;
      external_username: string | null;
    }> = [];
    for (const row of (byId.data ?? []) as Array<Record<string, unknown>>) {
      profileIds.add(String(row.profile_id));
      matches.push({
        profile_id: String(row.profile_id),
        external_id: (row.external_id as string | null) ?? null,
        external_username: (row.external_username as string | null) ?? null,
      });
    }
    for (const row of (byUsername.data ?? []) as Array<Record<string, unknown>>) {
      profileIds.add(String(row.profile_id));
      matches.push({
        profile_id: String(row.profile_id),
        external_id: (row.external_id as string | null) ?? null,
        external_username: (row.external_username as string | null) ?? null,
      });
    }

    let labelById = new Map<string, string | null>();
    if (profileIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", [...profileIds]);
      labelById = new Map(
        ((profiles ?? []) as Array<Record<string, unknown>>).map((p) => [
          String(p.id),
          (p.full_name as string | null) || (p.email as string | null) || null,
        ]),
      );
    }

    for (const m of matches) {
      const label = labelById.get(m.profile_id) ?? null;
      if (m.external_id) {
        handleToProfile.set(m.external_id, { profile_id: m.profile_id, label });
      }
      if (m.external_username) {
        handleToProfile.set(m.external_username, {
          profile_id: m.profile_id,
          label,
        });
      }
    }
  }

  const totalParticipants = parsedRows.length;
  let autoLinkCount = 0;
  let walkInCount = 0;

  const rows: PreviewRow[] = parsedRows.map((row) => {
    const handle = (row.external_handle ?? "").trim();
    const match = handle ? handleToProfile.get(handle) : undefined;
    if (match) autoLinkCount += 1;
    else walkInCount += 1;
    const resolvedPoints =
      row.points != null && row.points >= 0
        ? row.points
        : defaultPointsForRank(row.final_rank, totalParticipants);
    return {
      ...row,
      proposed_profile_id: match?.profile_id ?? null,
      proposed_profile_label: match?.label ?? null,
      resolved_points: resolvedPoints,
    };
  });

  return {
    rows,
    auto_link_count: autoLinkCount,
    walk_in_count: walkInCount,
    total_participants: totalParticipants,
  };
}

export type ImportCommitResult = {
  inserted_or_updated: number;
  skipped: number;
  failed: Array<{ source_row: number; display_name: string; reason: string }>;
};

/**
 * Override per riga deciso dallo staff in fase di preview.
 *
 * - `keep`: mantieni `proposed_profile_id` calcolato dal preview (default).
 * - `walk_in`: ignora l'auto-link e salva la riga come walk-in (profile_id NULL).
 * - `link_to_profile`: forza un profile_id specifico (cercato dal picker UI).
 * - `skip`: non importare questa riga.
 */
export type RowOverrideAction = "keep" | "walk_in" | "link_to_profile" | "skip";

export type RowOverride = {
  action: RowOverrideAction;
  profile_id?: string | null;
};

export type RowOverrides = Map<number, RowOverride>;

/**
 * Esegue l'upsert riga-per-riga via `recordTournamentResult`, applicando gli
 * eventuali override dello staff (skip / walk_in / link_to_profile). Errori
 * per riga non interrompono il batch: vengono accumulati e ritornati.
 * Idempotente grazie ai UNIQUE indexes su (event_id, profile_id) e
 * (event_id, lower(display_name)).
 */
export async function commitImport(
  supabase: SupabaseClient,
  params: {
    eventId: string;
    rows: PreviewRow[];
    recordedBy?: string | null;
    format?: string | null;
    overrides?: RowOverrides;
  },
): Promise<ImportCommitResult> {
  if (!params.eventId) throw new Error("event_id_required");

  let success = 0;
  let skipped = 0;
  const failed: ImportCommitResult["failed"] = [];

  for (const row of params.rows) {
    const override = params.overrides?.get(row.source_row);
    const action: RowOverrideAction = override?.action ?? "keep";

    if (action === "skip") {
      skipped += 1;
      continue;
    }

    let profileId: string | null = row.proposed_profile_id;
    if (action === "walk_in") {
      profileId = null;
    } else if (action === "link_to_profile") {
      profileId = override?.profile_id ?? null;
      if (!profileId) {
        failed.push({
          source_row: row.source_row,
          display_name: row.display_name,
          reason: "override_profile_id_required",
        });
        continue;
      }
    }

    try {
      await recordTournamentResult(supabase, {
        eventId: params.eventId,
        profileId,
        displayName: row.display_name,
        externalHandle: row.external_handle,
        format: params.format ?? row.format,
        finalRank: row.final_rank,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
        points: row.resolved_points,
        recordedBy: params.recordedBy ?? null,
      });
      success += 1;
    } catch (error) {
      failed.push({
        source_row: row.source_row,
        display_name: row.display_name,
        reason: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  return { inserted_or_updated: success, skipped, failed };
}

/**
 * Cancella tutti i risultati di un evento. Utile per "reset" prima di
 * re-importare un CSV ripulito (anche se il commit è già idempotente, lo
 * staff a volte vuole ripartire da zero perché ha cambiato il display_name
 * o vuole spostare un giocatore da walk-in → profilo collegato).
 *
 * RLS staff_all su tournament_results garantisce l'autorizzazione.
 */
export async function deleteAllTournamentResultsForEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{ deleted: number }> {
  if (!eventId) throw new Error("event_id_required");

  const { data, error } = await supabase
    .from("tournament_results")
    .delete()
    .eq("event_id", eventId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return { deleted: (data ?? []).length };
}
