import Link from "next/link";

import { SocialLinks } from "@/components/social-links";

const footerColumns = [
  {
    title: "Esplora",
    links: [
      { href: "/events", label: "Eventi" },
      { href: "/news", label: "News" },
      { href: "/giochi", label: "Giochi e Tornei" },
    ],
  },
  {
    title: "Community",
    links: [
      { href: "/reserve", label: "Richieste prodotto" },
      { href: "/contact", label: "Contatti" },
      { href: "/protected", label: "Account" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-slate-950">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-amber-300/55">
            Mana Nero Fumetteria
          </p>
          <h2 className="mt-4 max-w-md text-3xl font-semibold text-white">
            Creatività, socialità e divertimento in un unico luogo.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/62">
            Via Alessandro Volta 16, 21049 Tradate (VA)<br />
            Tel. 0331 171 2653 · mananerofumetteria@gmail.com
          </p>
          <SocialLinks className="mt-6" />
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold text-white">{column.title}</h3>
              <div className="mt-4 flex flex-col gap-3 text-sm text-white/60">
                {column.links.map((link) => (
                  <Link key={link.href} href={link.href} className="transition hover:text-white">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
