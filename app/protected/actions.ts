"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  deleteOwnExternalIdentity,
  isExternalPlatform,
  upsertOwnExternalIdentity,
} from "@/lib/domain/tournaments";
import { updateOwnProfile } from "@/lib/domain/profile";
import { createClient } from "@/lib/supabase/server";

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const fullName = String(formData.get("full_name") || "").trim();
  const interestsRaw = String(formData.get("interests") || "").trim();
  const telegram = String(formData.get("telegram_username") || "").trim();
  const whatsapp = String(formData.get("whatsapp_e164") || "").trim();

  await updateOwnProfile(supabase, {
    userId: user.id,
    fullName: fullName || null,
    interests: interestsRaw
      ? interestsRaw
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [],
    newsletterOptIn: formData.get("newsletter_opt_in") === "on",
    marketingConsent: formData.get("marketing_consent") === "on",
    telegramUsername: telegram || null,
    whatsappE164: whatsapp || null,
  });

  revalidatePath("/protected");
  redirect("/protected?success=profile_saved");
}

export async function saveExternalIdentity(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const platform = String(formData.get("platform") || "").trim();
  if (!isExternalPlatform(platform)) {
    redirect("/protected?error=identity_platform_invalid#identita-esterne");
  }

  try {
    await upsertOwnExternalIdentity(supabase, {
      profileId: user.id,
      platform,
      externalId: String(formData.get("external_id") || "").trim(),
      externalUsername: String(formData.get("external_username") || "").trim(),
      notes: String(formData.get("notes") || "").trim(),
    });
  } catch (error) {
    redirect(
      `/protected?error=${encodeURIComponent(
        error instanceof Error ? error.message : "identity_save_failed",
      )}#identita-esterne`,
    );
  }

  revalidatePath("/protected");
  redirect("/protected?success=identity_saved#identita-esterne");
}

export async function deleteExternalIdentity(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const identityId = String(formData.get("identity_id") || "").trim();
  if (!identityId) {
    redirect("/protected?error=identity_id_missing#identita-esterne");
  }

  try {
    await deleteOwnExternalIdentity(supabase, identityId);
  } catch (error) {
    redirect(
      `/protected?error=${encodeURIComponent(
        error instanceof Error ? error.message : "identity_delete_failed",
      )}#identita-esterne`,
    );
  }

  revalidatePath("/protected");
  redirect("/protected?success=identity_removed#identita-esterne");
}
