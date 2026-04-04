"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const navLinks = [
  { href: "/events", label: "Eventi" },
  { href: "/news", label: "News" },
  { href: "/community", label: "Community" },
  { href: "/reserve", label: "Richieste" },
  { href: "/protected", label: "Account" },
];

export function DesktopNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {navLinks.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(link.href + "/");

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "relative rounded-full px-4 py-2 text-sm transition",
              isActive
                ? "text-white bg-white/10"
                : "text-white/72 hover:bg-white/10 hover:text-white",
            )}
          >
            {link.label}
            {isActive && (
              <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-amber-400" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
