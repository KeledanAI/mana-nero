import { AuthButton } from "@/components/auth-button";
import Link from "next/link";
import { Suspense } from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pb-10 pt-4 sm:px-8">
        <header className="mb-10 rounded-[1.75rem] border border-border/70 bg-card/80 px-5 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href="/" className="text-xs uppercase tracking-[0.28em] text-foreground/55">
                Mana Nero
              </Link>
              <h1 className="mt-2 text-2xl font-semibold">Area utente</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/events" className="text-sm text-foreground/70 transition hover:text-foreground">
                Eventi
              </Link>
              <Link href="/reserve" className="text-sm text-foreground/70 transition hover:text-foreground">
                Richieste prodotto
              </Link>
              <Suspense>
                <AuthButton />
              </Suspense>
            </div>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
