"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logStaffCrmAction } from "@/lib/gamestore/crm-audit";
import { requireUserWithRole } from "@/lib/gamestore/authz";
import {
  defaultPointsForRank,
  deleteTournamentResult,
  recordTournamentResult,
} from "@/lib/domain/tournaments";
import { deleteAllTournamentResultsForEvent } from "@/lib/domain/tournament-import";

function intFromForm(formData: FormData, key: string): number {
  const raw = formData.get(key);
  const value = Number(typeof raw === "string" ? raw : "");
  return Number.isFinite(value) ? value : 0;
}

function optionalNumberFromForm(formData: FormData, key: string): number | undefined {
  const raw = formData.get(key);
  if (raw === null || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function optionalStringFromForm(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

export async function recordTournamentResultAction(formData: FormData) {
  const { supabase, user } = await requireUserWithRole("staff");
  const eventId = String(formData.get("event_id") || "").trim();
  if (!eventId) redirect("/admin/events?error=missing_event_id");

  const profileIdRaw = String(formData.get("profile_id") || "").trim();
  const displayName = String(formData.get("display_name") || "").trim();
  const finalRank = intFromForm(formData, "final_rank");
  const totalParticipants = optionalNumberFromForm(formData, "total_participants");

  if (!displayName) {
    redirect(`/admin/events/${eventId}/scoring?error=display_name_required`);
  }
  if (!Number.isFinite(finalRank) || finalRank < 1) {
    redirect(`/admin/events/${eventId}/scoring?error=final_rank_invalid`);
  }

  const explicitPoints = optionalNumberFromForm(formData, "points");
  const points =
    typeof explicitPoints === "number"
      ? explicitPoints
      : typeof totalParticipants === "number"
        ? defaultPointsForRank(finalRank, totalParticipants)
        : 0;

  try {
    const result = await recordTournamentResult(supabase, {
      eventId,
      profileId: profileIdRaw || null,
      displayName,
      externalHandle: optionalStringFromForm(formData, "external_handle"),
      format: optionalStringFromForm(formData, "format"),
      finalRank,
      wins: intFromForm(formData, "wins"),
      losses: intFromForm(formData, "losses"),
      draws: intFromForm(formData, "draws"),
      points,
      recordedBy: user.id,
    });

    await logStaffCrmAction(supabase, user.id, {
      action_type: "record_tournament_result",
      entity_type: "tournament_result",
      entity_id: result.id,
      payload: {
        event_id: eventId,
        profile_id: result.profile_id,
        display_name: result.display_name,
        final_rank: result.final_rank,
        points: result.points,
      },
    });
  } catch (error) {
    redirect(
      `/admin/events/${eventId}/scoring?error=${encodeURIComponent(
        error instanceof Error ? error.message : "record_failed",
      )}`,
    );
  }

  revalidatePath(`/admin/events/${eventId}/scoring`);
  redirect(`/admin/events/${eventId}/scoring?success=result_saved`);
}

export async function deleteTournamentResultAction(formData: FormData) {
  const { supabase, user } = await requireUserWithRole("staff");
  const resultId = String(formData.get("result_id") || "").trim();
  const eventId = String(formData.get("event_id") || "").trim();
  if (!resultId || !eventId) redirect("/admin/events?error=missing_ids");

  try {
    await deleteTournamentResult(supabase, resultId);
    await logStaffCrmAction(supabase, user.id, {
      action_type: "delete_tournament_result",
      entity_type: "tournament_result",
      entity_id: resultId,
      payload: { event_id: eventId },
    });
  } catch (error) {
    redirect(
      `/admin/events/${eventId}/scoring?error=${encodeURIComponent(
        error instanceof Error ? error.message : "delete_failed",
      )}`,
    );
  }

  revalidatePath(`/admin/events/${eventId}/scoring`);
  redirect(`/admin/events/${eventId}/scoring?success=result_removed`);
}

/**
 * "Reset risultati": cancella tutti i tournament_results dell'evento.
 * Richiede una conferma testuale ("CANCELLA") inviata dal form per ridurre
 * il rischio di click accidentali. Tracciato in CRM audit con il count.
 */
export async function deleteAllTournamentResultsAction(formData: FormData) {
  const { supabase, user } = await requireUserWithRole("staff");
  const eventId = String(formData.get("event_id") || "").trim();
  const confirm = String(formData.get("confirm") || "").trim().toUpperCase();
  if (!eventId) redirect("/admin/events?error=missing_event_id");
  if (confirm !== "CANCELLA") {
    redirect(`/admin/events/${eventId}/scoring?error=confirmation_required`);
  }

  try {
    const result = await deleteAllTournamentResultsForEvent(supabase, eventId);
    await logStaffCrmAction(supabase, user.id, {
      action_type: "reset_tournament_results",
      entity_type: "event",
      entity_id: eventId,
      payload: { deleted: result.deleted },
    });
  } catch (error) {
    redirect(
      `/admin/events/${eventId}/scoring?error=${encodeURIComponent(
        error instanceof Error ? error.message : "reset_failed",
      )}`,
    );
  }

  revalidatePath(`/admin/events/${eventId}/scoring`);
  redirect(`/admin/events/${eventId}/scoring?success=results_reset`);
}
