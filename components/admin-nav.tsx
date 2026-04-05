"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dashboard", match: (p: string) => p === "/admin" },
  {
    href: "/admin/events",
    label: "Eventi",
    match: (p: string) => p.startsWith("/admin/events"),
  },
  {
    href: "/admin/categories",
    label: "Categorie",
    match: (p: string) => p.startsWith("/admin/categories"),
  },
  {
    href: "/admin/posts",
    label: "News",
    match: (p: string) => p.startsWith("/admin/posts"),
  },
  {
    href: "/admin/game-pages",
    label: "Pagine gioco",
    match: (p: string) => p.startsWith("/admin/game-pages"),
  },
  {
    href: "/admin/product-requests",
    label: "Richieste prodotto",
    match: (p: string) => p.startsWith("/admin/product-requests"),
  },
  {
    href: "/admin/newsletter",
    label: "Newsletter",
    match: (p: string) => p.startsWith("/admin/newsletter"),
  },
  {
    href: "/admin/crm",
    label: "CRM",
    match: (p: string) => p.startsWith("/admin/crm"),
  },
];

export function AdminNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      {links.map(({ href, label, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm transition",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground/75 hover:bg-secondary hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
      <Link
        href="/"
        className="rounded-full px-3 py-1.5 text-sm text-foreground/60 hover:bg-secondary hover:text-foreground"
      >
        Sito pubblico
      </Link>
    </nav>
  );
}
