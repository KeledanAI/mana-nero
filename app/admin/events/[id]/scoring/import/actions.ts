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
} from "@/lib/domain/tournament-import";
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

export async function previewImportAction(formData: FormData): Promise<PreviewActionResult> {
  const { supabase } = await requireUserWithRole("staff");
  const eventId = String(formData.get("event_id") || "").trim();
  if (!eventId) return { ok: false, reason: "missing_event_id" };

  const csv = String(formData.get("csv") || "");
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

  const csv = String(formData.get("csv") || "");
  if (!csv.trim()) return { ok: false, reason: "csv_empty" };

  const sourceChoice = readSource(formData.get("source"));
  const formatOverride = String(formData.get("format") || "").trim() || null;

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
  });

  await logStaffCrmAction(supabase, user.id, {
    action_type: "csv_import_tournament_results",
    entity_type: "event",
    entity_id: eventId,
    payload: {
      source: parsed.source,
      total_rows: preview.rows.length,
      inserted_or_updated: result.inserted_or_updated,
      failed_count: result.failed.length,
      auto_link_count: preview.auto_link_count,
      walk_in_count: preview.walk_in_count,
    },
  });

  revalidatePath(`/admin/events/${eventId}/scoring`);
  revalidatePath(`/admin/events/${eventId}/scoring/import`);

  return {
    ok: true,
    inserted_or_updated: result.inserted_or_updated,
    failed: result.failed,
    auto_link_count: preview.auto_link_count,
    walk_in_count: preview.walk_in_count,
    total: preview.rows.length,
  };
}
