import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function NewsCard({
  imageUrl,
  title,
  description,
  meta,
  href,
  className,
}: {
  imageUrl: string;
  title: string;
  description: string;
  meta: string;
  href: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "group overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900/75",
        className,
      )}
    >
      <div
        className="h-48 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(4,6,17,0.08) 0%, rgba(4,6,17,0.8) 100%), url(${imageUrl})`,
        }}
      />
      <div className="space-y-4 p-6">
        <Badge className="border-0 bg-cyan-400/18 text-cyan-200 hover:bg-cyan-400/18">
          Aggiornamento
        </Badge>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">{meta}</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">{title}</h3>
        </div>
        <p className="text-sm leading-7 text-white/62">{description}</p>
        <Link href={href} className="inline-flex text-sm font-medium text-cyan-200 hover:text-cyan-100">
          Leggi aggiornamento
        </Link>
      </div>
    </article>
  );
}
