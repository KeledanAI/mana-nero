import type { SupabaseClient } from "@supabase/supabase-js";

import { enqueueMessageWithClient } from "@/lib/comms/enqueue";

const CAMPAIGN_ID_MAX = 64;
const SUBJECT_MAX = 120;
const TEASER_MAX = 2000;
const MAX_RECIPIENTS = 250;

/** Segmenti staff supportati (estensione oltre newsletter opt-in). */
export type StaffCampaignSegment =
  | "newsletter_opt_in"
  | "marketing_consent"
  | "registration_waitlisted";

export function parseStaffCampaignSegment(raw: string): StaffCampaignSegment {
  const s = String(raw ?? "").trim();
  if (s === "marketing_consent") return "marketing_consent";
  if (s === "registration_waitlisted") return "registration_waitlisted";
  return "newsletter_opt_in";
}

/**
 * Chiave idempotency per campagne segmentate: include il segmento per evitare collisioni tra liste.
 * @see docs/design-v2-comms-automation.md
 */
export function campaignSegmentIdempotencyKey(
  segment: StaffCampaignSegment,
  campaignId: string,
  userId: string,
): string {
  return `campaign:${segment}:${campaignId}:${userId}`;
}

/**
 * Normalizza id campagna staff (slug sicuro per chiave idempotency).
 */
export function normalizeCampaignId(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!s || s.length > CAMPAIGN_ID_MAX) return null;
  return s;
}

export type EnqueueStaffSegmentCampaignInput = {
  campaignId: string;
  subjectLine: string;
  teaser: string;
  segment: StaffCampaignSegment;
};

export type EnqueueNewsletterCampaignInput = Omit<EnqueueStaffSegmentCampaignInput, "segment">;

function consentSegmentQuery(
  supabase: SupabaseClient,
  segment: "newsletter_opt_in" | "marketing_consent",
) {
  let q = supabase.from("profiles").select("id").not("email", "is", null).limit(MAX_RECIPIENTS);
  if (segment === "newsletter_opt_in") {
    q = q.eq("newsletter_opt_in", true);
  } else {
    q = q.eq("marketing_consent", true);
  }
  return q;
}

async function waitlistedProfileIdsWithEmail(supabase: SupabaseClient): Promise<{ id: string }[]> {
  const { data: regs, error: regErr } = await supabase
    .from("event_registrations")
    .select("user_id")
    .eq("status", "waitlisted")
    .not("user_id", "is", null)
    .limit(800);

  if (regErr) {
    throw new Error(regErr.message);
  }

  const ids = new Set<string>();
  for (const row of regs ?? []) {
    const uid = row.user_id as string | null;
    if (uid) ids.add(uid);
  }
  const ordered = [...ids];
  if (ordered.length === 0) return [];

  const slice = ordered.slice(0, MAX_RECIPIENTS);
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id")
    .in("id", slice)
    .not("email", "is", null)
    .limit(MAX_RECIPIENTS);

  if (profErr) {
    throw new Error(profErr.message);
  }
  return (profiles ?? []) as { id: string }[];
}

/**
 * Accoda messaggi email `campaign_segment` per un segmento profilo (newsletter o marketing consent).
 * Solo enqueue outbox; il worker `processOutboxBatch` invia.
 */
export async function enqueueStaffSegmentCampaign(
  supabase: SupabaseClient,
  input: EnqueueStaffSegmentCampaignInput,
): Promise<{ attempted: number; errors: string[] }> {
  const campaignId = normalizeCampaignId(input.campaignId);
  if (!campaignId) {
    throw new Error("campaign_id_invalid");
  }
  const subjectLine = input.subjectLine.trim().slice(0, SUBJECT_MAX);
  if (!subjectLine) {
    throw new Error("subject_required");
  }
  const teaser = input.teaser.trim().slice(0, TEASER_MAX);
  const segment = input.segment;

  let rows: { id: string }[];
  if (segment === "registration_waitlisted") {
    rows = await waitlistedProfileIdsWithEmail(supabase);
  } else {
    const { data: profiles, error: listErr } = await consentSegmentQuery(supabase, segment);
    if (listErr) {
      throw new Error(listErr.message);
    }
    rows = (profiles ?? []) as { id: string }[];
  }
  const errors: string[] = [];
  let attempted = 0;

  for (const row of rows) {
    const userId = row.id as string;
    attempted += 1;
    try {
      await enqueueMessageWithClient(supabase, {
        idempotencyKey: campaignSegmentIdempotencyKey(segment, campaignId, userId),
        channel: "email",
        payload: {
          kind: "campaign_segment",
          user_id: userId,
          campaign_id: campaignId,
          subject_line: subjectLine,
          teaser,
          segment_kind: segment,
        },
      });
    } catch (e) {
      errors.push(`${userId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { attempted, errors };
}

/** Wrapper: segmento newsletter opt-in. */
export async function enqueueNewsletterOptInCampaign(
  supabase: SupabaseClient,
  input: EnqueueNewsletterCampaignInput,
): Promise<{ attempted: number; errors: string[] }> {
  return enqueueStaffSegmentCampaign(supabase, { ...input, segment: "newsletter_opt_in" });
}
