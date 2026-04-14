"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { userMeetsRole } from "@/lib/auth/roles";
import {
  enqueueStaffSegmentCampaign,
  normalizeCampaignId,
  parseStaffCampaignSegment,
} from "@/lib/comms/campaign-segment-enqueue";
import { enqueueEventReminder24hScan } from "@/lib/comms/event-reminders";
import { enqueueMessage } from "@/lib/comms/enqueue";
import { runBookingAction } from "@/lib/domain/booking";
import { logStaffCrmAction } from "@/lib/gamestore/crm-audit";
import { requireUserWithRole } from "@/lib/gamestore/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { CMS_STORAGE_BUCKET } from "@/lib/supabase/cms-storage";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function sanitizeFilename(filename: string) {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extensionFromType(type: string, fallbackName: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  const clean = sanitizeFilename(fallbackName);
  const ext = clean.split(".").pop();
  return ext && ext.length <= 5 ? ext : "jpg";
}

function validateUploadImage(file: File) {
  if (!file || file.size <= 0) return;
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Formato immagine non supportato. Usa JPG, PNG o WEBP.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Immagine troppo grande. Limite massimo 5MB.");
  }
}

async function uploadCmsImage(
  supabase: Awaited<ReturnType<typeof requireUserWithRole>>["supabase"],
  entity: "events" | "posts" | "game-pages",
  entityKey: string,
  file: File,
) {
  validateUploadImage(file);
  if (file.size <= 0) return null;

  const ext = extensionFromType(file.type, file.name || "image.jpg");
  const safeName = sanitizeFilename((file.name || "image").replace(/\.[^.]*$/, "")) || "image";
  const objectPath = `${entity}/${sanitizeFilename(entityKey)}/${Date.now()}-${safeName}.${ext}`;

  const { error } = await supabase.storage
    .from(CMS_STORAGE_BUCKET)
    .upload(objectPath, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new Error(error.message);
  }

  return objectPath;
}

export async function saveEvent(formData: FormData) {
  const { supabase } = await requireUserWithRole("staff");

  const id = String(formData.get("id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const gameType = String(formData.get("game_type") || "").trim();
  const startsAt = String(formData.get("starts_at") || "").trim();
  const endsAt = String(formData.get("ends_at") || "").trim();
  const capacity = Number.parseInt(String(formData.get("capacity") || "0"), 10);
  const priceDisplay = String(formData.get("price_display") || "").trim();
  const priceCentsRaw = String(formData.get("price_cents") || "").trim();
  const depositCentsRaw = String(formData.get("deposit_cents") || "").trim();
  const currency = String(formData.get("currency") || "eur").trim().toLowerCase() || "eur";
  const priceCents =
    priceCentsRaw === "" ? null : Number.parseInt(priceCentsRaw, 10);
  const depositCents =
    depositCentsRaw === "" ? null : Number.parseInt(depositCentsRaw, 10);
  const categoryId = String(formData.get("category_id") || "").trim();
  const status = String(formData.get("status") || "draft").trim();
  const checkInEarlyRaw = String(formData.get("check_in_early_days") || "").trim();
  const checkInLateRaw = String(formData.get("check_in_late_hours") || "").trim();
  let checkInEarlyDays: number | null = null;
  let checkInLateHours: number | null = null;
  if (checkInEarlyRaw) {
    const n = Number.parseInt(checkInEarlyRaw, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 60) checkInEarlyDays = n;
  }
  if (checkInLateRaw) {
    const n = Number.parseInt(checkInLateRaw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 336) checkInLateHours = n;
  }
  const coverImagePathInput = String(formData.get("cover_image_path") || "").trim();
  const coverImageFile = formData.get("cover_image");
  const eventKey = id || slug || crypto.randomUUID();

  let uploadedCoverPath: string | null = null;
  if (coverImageFile instanceof File && coverImageFile.size > 0) {
    try {
      uploadedCoverPath = await uploadCmsImage(supabase, "events", eventKey, coverImageFile);
    } catch (error) {
      const message = error instanceof Error ? error.message : "upload_failed";
      redirect(`/admin/events?error=${encodeURIComponent(message)}`);
    }
  }

  const payload = {
    title,
    slug,
    description: description || null,
    game_type: gameType || null,
    starts_at: startsAt,
    ends_at: endsAt || null,
    capacity,
    price_display: priceDisplay || null,
    price_cents:
      priceCents != null && !Number.isNaN(priceCents) && priceCents >= 0
        ? priceCents
        : null,
    deposit_cents:
      depositCents != null && !Number.isNaN(depositCents) && depositCents >= 0
        ? depositCents
        : null,
    currency: currency.length === 3 ? currency : "eur",
    category_id: categoryId ? categoryId : null,
    cover_image_path: uploadedCoverPath || coverImagePathInput || null,
    status,
    check_in_early_days: checkInEarlyDays,
    check_in_late_hours: checkInLateHours,
    updated_at: new Date().toISOString(),
  };

  const query = id
    ? supabase.from("events").update(payload).eq("id", id)
    : supabase.from("events").insert(payload);

  const { error } = await query;

  if (error) redirect(`/admin/events?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/");
  redirect("/admin/events?success=event_saved");
}

export async function deleteEvent(formData: FormData) {
  const { supabase } = await requireUserWithRole("staff");
  const id = String(formData.get("id") || "").trim();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) redirect(`/admin/events?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/");
  redirect("/admin/events?success=event_deleted");
}

export async function savePost(formData: FormData) {
  const { supabase, user } = await requireUserWithRole("staff");
  const id = String(formData.get("id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const status = String(formData.get("status") || "draft").trim();
  const coverImagePathInput = String(formData.get("cover_image_path") || "").trim();
  const coverImageFile = formData.get("cover_image");
  const postKey = id || slug || crypto.randomUUID();

  let uploadedCoverPath: string | null = null;
  if (coverImageFile instanceof File && coverImageFile.size > 0) {
    try {
      uploadedCoverPath = await uploadCmsImage(supabase, "posts", postKey, coverImageFile);
    } catch (error) {
      const message = error instanceof Error ? error.message : "upload_failed";
      redirect(`/admin/posts?error=${encodeURIComponent(message)}`);
    }
  }

  let publishedAt: string | null = null;
  if (status === "published") {
    if (id) {
      const { data: existing } = await supabase
        .from("posts")
        .select("published_at")
        .eq("id", id)
        .maybeSingle();
      publishedAt = existing?.published_at ?? new Date().toISOString();
    } else {
      publishedAt = new Date().toISOString();
    }
  }

  const payload = {
    title,
    slug,
    body: body || null,
    cover_image_path: uploadedCoverPath || coverImagePathInput || null,
    status,
    published_at: publishedAt,
    updated_at: new Date().toISOString(),
  };

  const query = id
    ? supabase.from("posts").update(payload).eq("id", id)
    : supabase.from("posts").insert({ ...payload, author_id: user.id });

  const { error } = await query;
  if (error) redirect(`/admin/posts?error=${encodeURIComponent(error.message)}`);

  await enqueueMessage({
    idempotencyKey: `post:${slug}:${status}`,
    channel: "internal",
    payload: { kind: "post_saved", slug, status, title },
  });

  revalidatePath("/admin/posts");
  revalidatePath("/news");
  revalidatePath("/");
  redirect("/admin/posts?success=post_saved");
}

export async function deletePost(formData: FormData) {
  const { supabase } = await requireUserWithRole("staff");
  const id = String(formData.get("id") || "").trim();
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) redirect(`/admin/posts?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/posts");
  revalidatePath("/news");
  revalidatePath("/");
  redirect("/admin/posts?success=post_deleted");
}

export async function addAdminNote(formData: FormData) {
  const { supabase, user } = await requireUserWithRole("staff");
  const subjectProfileId = String(formData.get("subject_profile_id") || "").trim();
  const body = String(formData.get("body") || "").trim();

  const { error } = await supabase.from("admin_notes").insert({
    subject_profile_id: subjectProfileId,
    author_id: user.id,
    body,
  });

  if (error) {
    redirect(
      `/admin/crm/${encodeURIComponent(subjectProfileId)}?error=${encodeURIComponent(error.message)}`,
    );
  }
  await logStaffCrmAction(supabase, user.id, {
    action_type: "admin_note_created",
    entity_type: "profile",
    entity_id: subjectProfileId,
    payload: { body_preview: body.slice(0, 240) },
  });
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${subjectProfileId}`);
  redirect(`/admin/crm/${subjectProfileId}?success=note_saved`);
}

export async function checkInRegistration(formData: FormData) {
  const { supabase, user } = await requireUserWithRole("staff");
  const registrationId = String(formData.get("registration_id") || "").trim();
  const eventId = String(formData.get("event_id") || "").trim();

  try {
    await runBookingAction(supabase, "staff_check_in", {
      registrationId,
      eventId: null,
    });
  } catch (error) {
    redirect(
      `/admin/events/${eventId}?error=${encodeURIComponent(
        error instanceof Error ? error.message : "check_in_failed",
      )}`,
    );
  }

  await logStaffCrmAction(supabase, user.id, {
    action_type: "staff_check_in",
    entity_type: "event_registration",
    entity_id: registrationId,
    payload: { event_id: eventId },
  });
  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}?success=checked_in`);
}

export async function revokeMarketingConsentForSubject(formData: FormData) {
  const { supabase, user } = await requireUserWithRole("staff");
  const subjectId = String(formData.get("subject_profile_id") || "").trim();
  if (!subjectId) {
    redirect("/admin/crm?error=missing_subject");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ marketing_consent: false, updated_at: new Date().toISOString() })
    .eq("id", subjectId);

  if (error) {
    redirect(`/admin/crm/${subjectId}?error=${encodeURIComponent(error.message)}`);
  }

  let outboxCancelled = 0;
  let outboxCancelNote: string | undefined;
  const { data: cancelRpc, error: cancelErr } = await supabase.rpc(
    "staff_cancel_pending_marketing_campaign_outbox",
    { p_profile_id: subjectId },
  );
  const cancelPayload = cancelRpc as { ok?: boolean; cancelled?: number; error?: string } | null;
  if (!cancelErr && cancelPayload?.ok) {
    outboxCancelled = Number(cancelPayload.cancelled ?? 0);
  } else {
    outboxCancelNote =
      cancelErr?.message ?? cancelPayload?.error ?? "outbox_cancel_rpc_unavailable_apply_migrations";
  }

  await logStaffCrmAction(supabase, user.id, {
    action_type: "marketing_consent_revoked",
    entity_type: "profile",
    entity_id: subjectId,
    payload: {
      outbox_campaign_pending_cancelled: outboxCancelled,
      ...(outboxCancelNote ? { outbox_cancel_note: outboxCancelNote } : {}),
    },
  });
  revalidatePath(`/admin/crm/${subjectId}`);
  revalidatePath("/admin/crm");
  redirect(`/admin/crm/${subjectId}?success=marketing_revoked`);
}

export async function revokeNewsletterOptInForSubject(formData: FormData) {
  const { supabase, user } = await requireUserWithRole("staff");
  const subjectId = String(formData.get("subject_profile_id") || "").trim();
  if (!subjectId) {
    redirect("/admin/crm?error=missing_subject");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ newsletter_opt_in: false, updated_at: new Date().toISOString() })
    .eq("id", subjectId);

  if (error) {
    redirect(`/admin/crm/${subjectId}?error=${encodeURIComponent(error.message)}`);
  }

  let outboxCancelled = 0;
  let outboxCancelNote: string | undefined;
  const { data: cancelRpc, error: cancelErr } = await supabase.rpc(
    "staff_cancel_pending_newsletter_campaign_outbox",
    { p_profile_id: subjectId },
  );
  const cancelPayload = cancelRpc as { ok?: boolean; cancelled?: number; error?: string } | null;
  if (!cancelErr && cancelPayload?.ok) {
    outboxCancelled = Number(cancelPayload.cancelled ?? 0);
  } else {
    outboxCancelNote =
      cancelErr?.message ?? cancelPayload?.error ?? "outbox_cancel_rpc_unavailable_apply_migrations";
  }

  await logStaffCrmAction(supabase, user.id, {
    action_type: "newsletter_opt_in_revoked",
    entity_type: "profile",
    entity_id: subjectId,
    payload: {
      outbox_campaign_pending_cancelled: outboxCancelled,
      ...(outboxCancelNote ? { outbox_cancel_note: outboxCancelNote } : {}),
    },
  });
  revalidatePath(`/admin/crm/${subjectId}`);
  revalidatePath("/admin/crm");
  redirect(`/admin/crm/${subjectId}?success=newsletter_revoked`);
}

export async function rotateRegistrationCheckInToken(formData: FormData) {
  const { supabase, user } = await requireUserWithRole("staff");
  const registrationId = String(formData.get("registration_id") || "").trim();
  const eventId = String(formData.get("event_id") || "").trim();

  if (!registrationId || !eventId) {
    redirect(`/admin/events/${eventId || "unknown"}?error=${encodeURIComponent("missing_ids")}`);
  }

  const { data, error } = await supabase.rpc("staff_rotate_registration_check_in_token", {
    p_registration_id: registrationId,
  });

  const payload = data as { ok?: boolean; error?: string } | null;
  if (error || !payload?.ok) {
    redirect(
      `/admin/events/${eventId}?error=${encodeURIComponent(
        error?.message ?? payload?.error ?? "rotate_failed",
      )}`,
    );
  }

  await supabase.from("staff_crm_audit_log").insert({
    actor_id: user.id,
    action_type: "rotate_check_in_token",
    entity_type: "event_registration",
    entity_id: registrationId,
    payload: { event_id: eventId },
  });

  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}?success=qr_token_rotated`);
}

export async function saveCommsCampaignRecord(formData: FormData) {
  const { supabase, user } = await requireUserWithRole("staff");
  const slug = normalizeCampaignId(String(formData.get("record_slug") || ""));
  const title = String(formData.get("record_title") || "").trim();
  const segmentRaw = String(formData.get("record_segment") || "newsletter_opt_in").trim();
  const segment_kind = parseStaffCampaignSegment(segmentRaw);
  const subject_line = String(formData.get("record_subject") || "").trim() || null;
  const teaser = String(formData.get("record_teaser") || "").trim() || null;

  if (!slug) {
    redirect(`/admin/comms?error=${encodeURIComponent("slug_invalid")}`);
  }
  if (!title) {
    redirect(`/admin/comms?error=${encodeURIComponent("title_required")}`);
  }

  const { error } = await supabase.from("comms_campaigns").insert({
    slug,
    title,
    segment_kind,
    subject_line,
    teaser,
    created_by: user.id,
  });

  if (error) {
    redirect(`/admin/comms?error=${encodeURIComponent(error.message)}`);
  }
  await logStaffCrmAction(supabase, user.id, {
    action_type: "comms_campaign_record_saved",
    entity_type: "comms_campaign",
    entity_id: null,
    payload: { slug, segment_kind },
  });
  revalidatePath("/admin/comms");
  redirect("/admin/comms?success=record_saved");
}

export async function saveEventCategory(formData: FormData) {
  const { supabase } = await requireUserWithRole("staff");
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  const description = String(formData.get("description") || "").trim();

  const payload = {
    name,
    slug,
    description: description || null,
  };

  const query = id
    ? supabase.from("event_categories").update(payload).eq("id", id)
    : supabase.from("event_categories").insert(payload);

  const { error } = await query;
  if (error) {
    redirect(`/admin/categories?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/categories");
  revalidatePath("/admin/events");
  redirect("/admin/categories?success=category_saved");
}

export async function deleteEventCategory(formData: FormData) {
  const { supabase } = await requireUserWithRole("staff");
  const id = String(formData.get("id") || "").trim();
  const { error } = await supabase.from("event_categories").delete().eq("id", id);
  if (error) {
    redirect(`/admin/categories?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/admin/categories");
  revalidatePath("/admin/events");
  redirect("/admin/categories?success=category_deleted");
}

export async function runEventReminderScan() {
  await requireUserWithRole("staff");
  try {
    const result = await enqueueEventReminder24hScan();
    revalidatePath("/admin/comms");
    redirect(
      `/admin/comms?events=${encodeURIComponent(String(result.eventsScanned))}&attempted=${encodeURIComponent(String(result.remindersAttempted))}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "reminder_scan_failed";
    redirect(`/admin/comms?error=${encodeURIComponent(message)}`);
  }
}

export async function runNewsletterCampaignEnqueue(formData: FormData) {
  const { supabase, user } = await requireUserWithRole("staff");
  const recordId = String(formData.get("comms_campaign_id") || "").trim();
  let campaignId = String(formData.get("campaign_id") || "").trim();
  let subjectLine = String(formData.get("campaign_subject") || "").trim();
  let teaser = String(formData.get("campaign_teaser") || "").trim();
  let segmentRaw = String(formData.get("campaign_segment") || "newsletter_opt_in").trim();

  if (recordId) {
    const { data: rec, error: recErr } = await supabase
      .from("comms_campaigns")
      .select("slug, title, segment_kind, subject_line, teaser")
      .eq("id", recordId)
      .maybeSingle();
    if (recErr || !rec) {
      redirect(`/admin/comms?error=${encodeURIComponent(recErr?.message ?? "campaign_record_not_found")}`);
    }
    campaignId = rec.slug;
    segmentRaw = rec.segment_kind;
    if (rec.subject_line) subjectLine = rec.subject_line;
    if (rec.teaser) teaser = rec.teaser;
    if (!subjectLine.trim()) {
      subjectLine = (rec.title ?? "").trim() || subjectLine;
    }
    if (!subjectLine.trim()) {
      redirect(`/admin/comms?error=${encodeURIComponent("subject_required_for_record")}`);
    }
  }

  const segment = parseStaffCampaignSegment(segmentRaw);

  try {
    const admin = createAdminClient();
    const result = await enqueueStaffSegmentCampaign(admin, {
      campaignId,
      subjectLine,
      teaser,
      segment,
    });
    await logStaffCrmAction(supabase, user.id, {
      action_type: "campaign_segment_enqueued",
      entity_type: "comms_campaign",
      entity_id: recordId || null,
      payload: { campaign_slug: campaignId, segment, attempted: result.attempted },
    });
    revalidatePath("/admin/comms");
    const errQ =
      result.errors.length > 0
        ? `&campaign_errors=${encodeURIComponent(String(result.errors.length))}`
        : "";
    redirect(
      `/admin/comms?campaign_attempted=${encodeURIComponent(String(result.attempted))}${errQ}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "campaign_enqueue_failed";
    redirect(`/admin/comms?error=${encodeURIComponent(message)}`);
  }
}

export async function updateProductRequestStatus(formData: FormData) {
  const { supabase, user } = await requireUserWithRole("staff");
  const id = String(formData.get("id") || "").trim();
  const status = String(formData.get("status") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const expectedRaw = String(formData.get("expected_fulfillment_at") || "").trim();
  const stockNotifiedRaw = String(formData.get("stock_notified_at") || "").trim();

  const allowed = [
    "new",
    "in_review",
    "fulfilled",
    "cancelled",
    "awaiting_stock",
  ] as const;
  if (!allowed.includes(status as (typeof allowed)[number])) {
    redirect("/admin/product-requests?error=invalid_status");
  }

  let expectedFulfillmentAt: string | null = null;
  if (expectedRaw) {
    const d = new Date(expectedRaw);
    if (Number.isNaN(d.getTime())) {
      redirect("/admin/product-requests?error=invalid_expected_fulfillment_at");
    }
    expectedFulfillmentAt = d.toISOString();
  }

  let stockNotifiedAt: string | null = null;
  if (stockNotifiedRaw) {
    const d = new Date(stockNotifiedRaw);
    if (Number.isNaN(d.getTime())) {
      redirect("/admin/product-requests?error=invalid_stock_notified_at");
    }
    stockNotifiedAt = d.toISOString();
  }

  const { error } = await supabase
    .from("product_reservation_requests")
    .update({
      status,
      notes: notes || null,
      expected_fulfillment_at: expectedFulfillmentAt,
      stock_notified_at: stockNotifiedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    redirect(`/admin/product-requests?error=${encodeURIComponent(error.message)}`);
  }

  await logStaffCrmAction(supabase, user.id, {
    action_type: "product_request_updated",
    entity_type: "product_reservation_request",
    entity_id: id,
    payload: { status, expected_fulfillment_at: expectedFulfillmentAt, stock_notified_at: stockNotifiedAt },
  });
  revalidatePath("/admin/product-requests");
  redirect("/admin/product-requests?success=request_updated");
}

export async function saveGamePage(formData: FormData) {
  const { supabase } = await requireUserWithRole("staff");
  const id = String(formData.get("id") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  const displayName = String(formData.get("display_name") || "").trim();
  const eyebrow = String(formData.get("eyebrow") || "").trim();
  const heroTitle = String(formData.get("hero_title") || "").trim();
  const intro = String(formData.get("intro") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const status = String(formData.get("status") || "draft").trim();
  const sortOrderRaw = String(formData.get("sort_order") || "0").trim();
  const coverImagePathInput = String(formData.get("hero_image_path") || "").trim();
  const coverImageFile = formData.get("cover_image");
  const sortOrder = Number.parseInt(sortOrderRaw, 10);

  if (!id) {
    redirect(`/admin/game-pages?error=${encodeURIComponent("id_required")}`);
  }

  const pageKey = slug || id;
  let uploadedCoverPath: string | null = null;
  if (coverImageFile instanceof File && coverImageFile.size > 0) {
    try {
      uploadedCoverPath = await uploadCmsImage(supabase, "game-pages", pageKey, coverImageFile);
    } catch (error) {
      const message = error instanceof Error ? error.message : "upload_failed";
      redirect(`/admin/game-pages?error=${encodeURIComponent(message)}`);
    }
  }

  const payload = {
    display_name: displayName,
    eyebrow: eyebrow || null,
    hero_title: heroTitle,
    intro: intro || null,
    body: body || null,
    hero_image_path: uploadedCoverPath || coverImagePathInput || null,
    status,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("game_pages").update(payload).eq("id", id);

  if (error) {
    redirect(`/admin/game-pages?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/game-pages");
  revalidatePath("/giochi");
  revalidatePath(`/giochi/${slug}`);
  revalidatePath("/community");
  revalidatePath("/");
  redirect("/admin/game-pages?success=game_page_saved");
}

export async function updateCustomerProfile(formData: FormData) {
  const { supabase, user, profile: actor } = await requireUserWithRole("staff");
  const id = String(formData.get("id") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();
  const interestsRaw = String(formData.get("interests") || "").trim();
  const interests = interestsRaw
    ? interestsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const newsletterOptIn = String(formData.get("newsletter_opt_in") || "") === "true";
  const marketingConsent = String(formData.get("marketing_consent") || "") === "true";
  const phone = String(formData.get("phone") || "").trim().slice(0, 64) || null;
  const tagsRaw = String(formData.get("crm_tags") || "").trim();
  const crm_tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 24)
        .map((t) => t.slice(0, 48))
    : [];
  const lead_stage = String(formData.get("lead_stage") || "").trim().slice(0, 80) || null;
  const stockLookaheadRaw = String(formData.get("stock_notification_lookahead_days") || "").trim();
  let stockNotificationLookaheadDays: number | null = null;
  if (stockLookaheadRaw) {
    const n = Number.parseInt(stockLookaheadRaw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 730) {
      stockNotificationLookaheadDays = n;
    }
  }

  const payload: Record<string, unknown> = {
    full_name: fullName || null,
    newsletter_opt_in: newsletterOptIn,
    marketing_consent: marketingConsent,
    phone,
    crm_tags,
    lead_stage,
    interests,
    stock_notification_lookahead_days: stockNotificationLookaheadDays,
    updated_at: new Date().toISOString(),
  };

  if (userMeetsRole(actor?.role, "admin")) {
    const role = String(formData.get("role") || "").trim();
    if (role === "customer" || role === "staff" || role === "admin") {
      payload.role = role;
    }
  }

  const { error } = await supabase.from("profiles").update(payload).eq("id", id);

  if (error) {
    redirect(`/admin/crm/${id}?error=${encodeURIComponent(error.message)}`);
  }

  let outboxNewsletterCancelled = 0;
  let outboxMarketingCancelled = 0;
  let outboxNewsletterNote: string | undefined;
  let outboxMarketingNote: string | undefined;

  if (!newsletterOptIn) {
    const { data: nlRpc, error: nlErr } = await supabase.rpc(
      "staff_cancel_pending_newsletter_campaign_outbox",
      { p_profile_id: id },
    );
    const nlPayload = nlRpc as { ok?: boolean; cancelled?: number; error?: string } | null;
    if (!nlErr && nlPayload?.ok) {
      outboxNewsletterCancelled = Number(nlPayload.cancelled ?? 0);
    } else {
      outboxNewsletterNote =
        nlErr?.message ?? nlPayload?.error ?? "outbox_cancel_rpc_unavailable_apply_migrations";
    }
  }
  if (!marketingConsent) {
    const { data: mkRpc, error: mkErr } = await supabase.rpc(
      "staff_cancel_pending_marketing_campaign_outbox",
      { p_profile_id: id },
    );
    const mkPayload = mkRpc as { ok?: boolean; cancelled?: number; error?: string } | null;
    if (!mkErr && mkPayload?.ok) {
      outboxMarketingCancelled = Number(mkPayload.cancelled ?? 0);
    } else {
      outboxMarketingNote =
        mkErr?.message ?? mkPayload?.error ?? "outbox_cancel_rpc_unavailable_apply_migrations";
    }
  }

  await logStaffCrmAction(supabase, user.id, {
    action_type: "customer_profile_updated",
    entity_type: "profile",
    entity_id: id,
    payload: {
      newsletter_opt_in: newsletterOptIn,
      marketing_consent: marketingConsent,
      phone_set: Boolean(phone),
      crm_tags_count: crm_tags.length,
      lead_stage_set: Boolean(lead_stage),
      stock_notification_lookahead_days: stockNotificationLookaheadDays,
      role_changed: userMeetsRole(actor?.role, "admin") ? (payload.role as string | undefined) : undefined,
      ...(outboxNewsletterCancelled > 0 || outboxNewsletterNote
        ? {
            outbox_newsletter_pending_cancelled: outboxNewsletterCancelled,
            ...(outboxNewsletterNote ? { outbox_newsletter_cancel_note: outboxNewsletterNote } : {}),
          }
        : {}),
      ...(outboxMarketingCancelled > 0 || outboxMarketingNote
        ? {
            outbox_marketing_pending_cancelled: outboxMarketingCancelled,
            ...(outboxMarketingNote ? { outbox_marketing_cancel_note: outboxMarketingNote } : {}),
          }
        : {}),
    },
  });

  revalidatePath(`/admin/crm/${id}`);
  revalidatePath("/admin/crm");
  redirect(`/admin/crm/${id}?success=profile_updated`);
}
