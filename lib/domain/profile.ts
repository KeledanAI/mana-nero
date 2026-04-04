import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileInput = {
  userId: string;
  fullName: string | null;
  interests: string[];
  newsletterOptIn: boolean;
  marketingConsent: boolean;
  telegramUsername: string | null;
  whatsappE164: string | null;
};

export async function updateOwnProfile(
  supabase: SupabaseClient,
  input: ProfileInput,
) {
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName,
      interests: input.interests,
      newsletter_opt_in: input.newsletterOptIn,
      marketing_consent: input.marketingConsent,
      telegram_username: input.telegramUsername,
      whatsapp_e164: input.whatsappE164,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.userId);

  if (error) {
    throw new Error(error.message);
  }
}
