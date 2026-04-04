import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createClient();

  // You can also use getUser() which will be slower.
  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;

  return user ? (
    <div className="flex items-center gap-3">
      <Link
        href="/protected"
        className="hidden text-sm text-white/72 transition hover:text-white lg:block"
      >
        {user.email}
      </Link>
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button
        asChild
        size="sm"
        variant={"outline"}
        className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
      >
        <Link href="/auth/login">Accedi</Link>
      </Button>
      <Button asChild size="sm" variant={"default"} className="shadow-[0_14px_30px_-15px_rgba(252,141,79,0.75)]">
        <Link href="/auth/sign-up">Registrati</Link>
      </Button>
    </div>
  );
}
