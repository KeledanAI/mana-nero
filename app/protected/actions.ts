"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
