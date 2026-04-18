"use server";

import { revalidatePath } from "next/cache";

import {
  CSV_IMPORT_SOURCES,
  parseTournamentResultsCsv,
  type CsvImportSource,
  type ParseError,
} from "@/lib/imports/tournament-results-csv";
import {
  commitImport,
  previewImport,
  type ImportPreview,
  type RowOverride,
  type RowOverrides,
} from "@/lib/domain/tournament-import";
import { searchProfiles, type ProfileSearchResult } from "@/lib/domain/profile-search";
import { logStaffCrmAction } from "@/lib/gamestore/crm-audit";
import { requireUserWithRole } from "@/lib/gamestore/authz";

export type PreviewActionResult =
  | {
      ok: true;
      source: CsvImportSource;
      preview: ImportPreview;
      parse_errors: ParseError[];
      recognized_headers: Record<string, string>;
    }
  | { ok: false; reason: string };

function readSource(value: FormDataEntryValue | null): CsvImportSource | "auto" {
  const raw = String(value ?? "auto");
  if (raw === "auto") return "auto";
  return (CSV_IMPORT_SOURCES as readonly string[]).includes(raw)
    ? (raw as CsvImportSource)
    : "auto";
}

/**
 * Estrae il CSV dal FormData. Supporta sia paste in textarea (`csv`) sia file
 * upload (`csv_file`). Se entrambi sono presenti il file ha precedenza.
 */
async function readCsvFromForm(formData: FormData): Promise<string> {
  const file = formData.get("csv_file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("file_too_large_2mb_max");
    }
    return await file.text();
  }
  return String(formData.get("csv") || "");
}

const ALLOWED_OVERRIDE_ACTIONS = new Set<RowOverride["action"]>([
  "keep",
  "walk_in",
  "link_to_profile",
  "skip",
]);

/**
 * Decodifica gli override `overrides_json` inviati dal client.
 * Formato atteso: `{"<source_row>": {"action": "...", "profile_id": "..."}}`
 */
function readOverrides(formData: FormData): RowOverrides {
  const raw = String(formData.get("overrides_json") || "").trim();
  if (!raw) return new Map();
  try {
    const parsed = JSON.parse(raw) as Record<string, { action?: string; profile_id?: string | null }>;
    const map: RowOverrides = new Map();
    for (const [key, value] of Object.entries(parsed)) {
      const sourceRow = Number.parseInt(key, 10);
      if (!Number.isFinite(sourceRow)) continue;
      const action = value?.action as RowOverride["action"] | undefined;
      if (!action || !ALLOWED_OVERRIDE_ACTIONS.has(action)) continue;
      map.set(sourceRow, {
        action,
        profile_id: value?.profile_id ?? null,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function previewImportAction(formData: FormData): Promise<PreviewActionResult> {
  const { supabase } = await requireUserWithRole("staff");
  const eventId = String(formData.get("event_id") || "").trim();
  if (!eventId) return { ok: false, reason: "missing_event_id" };

  let csv: string;
  try {
    csv = await readCsvFromForm(formData);
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "csv_read_failed" };
  }
  if (!csv.trim()) return { ok: false, reason: "csv_empty" };

  const sourceChoice = readSource(formData.get("source"));
  const parsed = parseTournamentResultsCsv(csv, {
    forceSource: sourceChoice === "auto" ? undefined : sourceChoice,
    maxRows: 1000,
  });

  if (parsed.rows.length === 0) {
    return {
      ok: false,
      reason: parsed.errors[0]?.reason ?? "no_rows_parsed",
    };
  }

  const preview = await previewImport(supabase, parsed.source, parsed.rows);

  return {
    ok: true,
    source: parsed.source,
    preview,
    parse_errors: parsed.errors,
    recognized_headers: Object.fromEntries(
      Object.entries(parsed.recognized_headers).map(([k, v]) => [k, v ?? ""]),
    ),
  };
}

export type CommitActionResult =
  | {
      ok: true;
      inserted_or_updated: number;
      skipped: number;
      failed: Array<{ source_row: number; display_name: string; reason: string }>;
      auto_link_count: number;
      walk_in_count: number;
      total: number;
    }
  | { ok: false; reason: string };

export async function commitImportAction(formData: FormData): Promise<CommitActionResult> {
  const { supabase, user } = await requireUserWithRole("staff");
  const eventId = String(formData.get("event_id") || "").trim();
  if (!eventId) return { ok: false, reason: "missing_event_id" };

  let csv: string;
  try {
    csv = await readCsvFromForm(formData);
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "csv_read_failed" };
  }
  if (!csv.trim()) return { ok: false, reason: "csv_empty" };

  const sourceChoice = readSource(formData.get("source"));
  const formatOverride = String(formData.get("format") || "").trim() || null;
  const overrides = readOverrides(formData);

  const parsed = parseTournamentResultsCsv(csv, {
    forceSource: sourceChoice === "auto" ? undefined : sourceChoice,
    maxRows: 1000,
  });
  if (parsed.rows.length === 0) {
    return { ok: false, reason: parsed.errors[0]?.reason ?? "no_rows_parsed" };
  }

  const preview = await previewImport(supabase, parsed.source, parsed.rows);

  const result = await commitImport(supabase, {
    eventId,
    rows: preview.rows,
    recordedBy: user.id,
    format: formatOverride,
    overrides,
  });

  await logStaffCrmAction(supabase, user.id, {
    action_type: "csv_import_tournament_results",
    entity_type: "event",
    entity_id: eventId,
    payload: {
      source: parsed.source,
      total_rows: preview.rows.length,
      inserted_or_updated: result.inserted_or_updated,
      skipped: result.skipped,
      failed_count: result.failed.length,
      overrides_count: overrides.size,
      auto_link_count: preview.auto_link_count,
      walk_in_count: preview.walk_in_count,
    },
  });

  revalidatePath(`/admin/events/${eventId}/scoring`);
  revalidatePath(`/admin/events/${eventId}/scoring/import`);

  return {
    ok: true,
    inserted_or_updated: result.inserted_or_updated,
    skipped: result.skipped,
    failed: result.failed,
    auto_link_count: preview.auto_link_count,
    walk_in_count: preview.walk_in_count,
    total: preview.rows.length,
  };
}

export type SearchProfilesActionResult =
  | { ok: true; profiles: ProfileSearchResult[] }
  | { ok: false; reason: string };

/**
 * Picker async per gli override "Collega a profilo". Limitato a staff via RLS.
 */
export async function searchProfilesAction(formData: FormData): Promise<SearchProfilesActionResult> {
  const { supabase } = await requireUserWithRole("staff");
  const query = String(formData.get("query") || "").trim();
  if (query.length < 2) return { ok: true, profiles: [] };
  try {
    const profiles = await searchProfiles(supabase, query, 8);
    return { ok: true, profiles };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "search_failed" };
  }
}
