"use client";

import {
  AuthTurnstile,
  type AuthTurnstileHandle,
  isTurnstileConfigured,
} from "@/components/auth-turnstile";
import { cn } from "@/lib/utils";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRef, useState } from "react";

const magicLinkCallbackUrl = () =>
  `${getSiteUrl()}/auth/confirm?next=${encodeURIComponent("/protected")}`;

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<AuthTurnstileHandle>(null);
  const captchaRequired = isTurnstileConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (captchaRequired && !captchaToken) {
      setError("Completa la verifica anti-bot.");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: magicLinkCallbackUrl(),
          shouldCreateUser: false,
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Si è verificato un errore");
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Controlla la tua email</CardTitle>
            <CardDescription>Ti abbiamo inviato un link per accedere</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Abbiamo inviato un link sicuro a <span className="font-medium text-foreground">{email}</span>.
              Cliccalo per entrare: non serve password.
            </p>
            <p>Se non vedi l&apos;email, controlla spam o richiedi un nuovo link dalla pagina Accedi.</p>
            <Button type="button" variant="outline" className="mt-2 w-full" onClick={() => setSent(false)}>
              Indietro
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Accedi</CardTitle>
          <CardDescription>
            Inserisci la tua email: riceverai un link per accedere senza password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <AuthTurnstile ref={turnstileRef} onTokenChange={setCaptchaToken} />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Invio in corso..." : "Inviami il link"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Non hai un account?{" "}
              <Link href="/auth/sign-up" className="underline underline-offset-4">
                Registrati
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
