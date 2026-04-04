import Link from "next/link";

import { AdminNav } from "@/components/admin-nav";
import { requireUserWithRole } from "@/lib/gamestore/authz";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireUserWithRole("staff");

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <header className="mb-8 rounded-[1.5rem] border border-border/70 bg-card/85 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/" className="text-xs uppercase tracking-[0.2em] text-foreground/55">
              Mana Nero
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">Pannello gestione</h1>
            <p className="mt-1 text-sm text-foreground/60">
              Accesso come <span className="font-medium text-foreground">{profile?.role ?? "staff"}</span>
            </p>
          </div>
          <AdminNav />
        </div>
      </header>
      {children}
    </main>
  );
}
