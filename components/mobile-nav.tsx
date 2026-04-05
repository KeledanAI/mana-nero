"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Menu, Newspaper, ShoppingBag, User, Users } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SocialLinks } from "@/components/social-links";
import { cn } from "@/lib/utils";

const links = [
  { href: "/events", label: "Eventi", icon: CalendarDays },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/community", label: "Giochi e Tornei", icon: Users },
  { href: "/reserve", label: "Richieste", icon: ShoppingBag },
  { href: "/protected", label: "Account", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="border-white/15 bg-white/5 text-white hover:bg-white/10 md:hidden"
        >
          <Menu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 border-white/10 bg-slate-950/95 text-white"
      >
        {links.map((link) => {
          const isActive =
            pathname === link.href || pathname.startsWith(link.href + "/");
          const Icon = link.icon;

          return (
            <DropdownMenuItem key={link.href} asChild>
              <Link
                href={link.href}
                className={cn(
                  "flex items-center gap-3",
                  isActive && "text-amber-300",
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <div className="border-t border-white/10 px-2 py-3">
          <SocialLinks className="justify-center" />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
