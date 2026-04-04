import Link from "next/link";
import { Suspense } from "react";

import { AuthButton } from "@/components/auth-button";
import { MobileNav } from "@/components/mobile-nav";
import { DesktopNavLinks } from "@/components/nav-links";
import { SocialLinks } from "@/components/social-links";
import { hasEnvVars } from "@/lib/utils";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/78 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#fc8d4f,#ffd576)] font-semibold text-slate-950 shadow-[0_12px_30px_-12px_rgba(252,141,79,0.85)]">
            MN
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/45">
              Fumetteria
            </p>
            <p className="text-sm font-semibold text-white">Mana Nero</p>
          </div>
        </Link>

        <DesktopNavLinks />

        <div className="flex items-center gap-3">
          <SocialLinks className="hidden md:flex" />
          <div className="hidden md:block">
            <Suspense>{hasEnvVars ? <AuthButton /> : null}</Suspense>
          </div>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
