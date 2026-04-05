"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

/**
 * Password reset via email is not used with magic-link auth.
 * Kept route for old bookmarks; points users to the OTP login flow.
 */
export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Accesso senza password</CardTitle>
          <CardDescription>Il Mana Nero usa un link inviato via email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Non gestiamo più il reset password classico: per entrare usa la pagina{" "}
            <strong className="text-foreground">Accedi</strong> e richiedi un nuovo link
            magico alla tua email.
          </p>
          <Button asChild className="w-full">
            <Link href="/auth/login">Vai ad Accedi</Link>
          </Button>
          <div className="text-center text-sm">
            <Link href="/auth/sign-up" className="underline underline-offset-4">
              Non hai un account? Registrati
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
