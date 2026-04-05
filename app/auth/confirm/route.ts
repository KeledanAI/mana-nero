import { safeAuthNextPath } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

function normalizeOtpType(type: string | null): EmailOtpType | null {
  if (!type) return null;
  if (type === "magiclink") return "email";
  return type as EmailOtpType;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = safeAuthNextPath(searchParams.get("next"));
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(next);
    }
    redirect(`/auth/error?error=${encodeURIComponent(error?.message ?? "exchange_failed")}`);
  }

  const token_hash = searchParams.get("token_hash");
  const type = normalizeOtpType(searchParams.get("type"));

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      // Relative path only: avoids redirect to localhost when `next` was an absolute URL.
      redirect(next);
    } else {
      // redirect the user to an error page with some instructions
      redirect(`/auth/error?error=${error?.message}`);
    }
  }

  // redirect the user to an error page with some instructions
  redirect(`/auth/error?error=No token hash or type`);
}
