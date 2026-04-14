"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { userMeetsRole } from "@/lib/auth/roles";
import { enqueueStaffSegmentCampaign } from "@/lib/comms/campaign-segment-enqueue";
import { enqueueEventReminder24hScan } from "@/lib/comms/event-reminders";
import { enqueueMessage } from "@/lib/comms/enqueue";
import { runBookingAction } from "@/lib/domain/booking";
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
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${subjectProfileId}`);
  redirect(`/admin/crm/${subjectProfileId}?success=note_saved`);
}

export async function checkInRegistration(formData: FormData) {
  const { supabase } = await requireUserWithRole("staff");
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

  revalidatePath(`/admin/events/${eventId}`);
  redirect(`/admin/events/${eventId}?success=checked_in`);
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
  await requireUserWithRole("staff");
  const campaignId = String(formData.get("campaign_id") || "").trim();
  const subjectLine = String(formData.get("campaign_subject") || "").trim();
  const teaser = String(formData.get("campaign_teaser") || "").trim();
  const segmentRaw = String(formData.get("campaign_segment") || "newsletter_opt_in").trim();
  const segment =
    segmentRaw === "marketing_consent" ? ("marketing_consent" as const) : ("newsletter_opt_in" as const);

  try {
    const admin = createAdminClient();
    const result = await enqueueStaffSegmentCampaign(admin, {
      campaignId,
      subjectLine,
      teaser,
      segment,
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
  const { supabase } = await requireUserWithRole("staff");
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
  const { supabase, profile: actor } = await requireUserWithRole("staff");
  const id = String(formData.get("id") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();
  const interestsRaw = String(formData.get("interests") || "").trim();
  const interests = interestsRaw
    ? interestsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const newsletterOptIn = String(formData.get("newsletter_opt_in") || "") === "true";
  const marketingConsent = String(formData.get("marketing_consent") || "") === "true";

  const payload: Record<string, unknown> = {
    full_name: fullName || null,
    newsletter_opt_in: newsletterOptIn,
    marketing_consent: marketingConsent,
    interests,
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

  revalidatePath(`/admin/crm/${id}`);
  revalidatePath("/admin/crm");
  redirect(`/admin/crm/${id}?success=profile_updated`);
}
