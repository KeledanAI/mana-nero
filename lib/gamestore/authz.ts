import { getProfileForUser, userMeetsRole, type AppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireUserWithRole(requiredRole: AppRole = "customer") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const profile = await getProfileForUser(supabase, user.id);

  if (!userMeetsRole(profile?.role, requiredRole)) {
    redirect("/protected");
  }

  return { supabase, user, profile };
}
