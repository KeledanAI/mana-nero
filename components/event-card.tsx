import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function EventCard({
  imageUrl,
  title,
  description,
  date,
  availability,
  href,
  category,
  className,
}: {
  imageUrl: string;
  title: string;
  description: string;
  date: string;
  availability: string;
  href: string;
  category?: string | null;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "group overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900/75 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.85)]",
        className,
      )}
    >
      <div
        className="h-56 bg-cover bg-center transition duration-500 group-hover:scale-[1.03]"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(8,10,21,0.08) 0%, rgba(8,10,21,0.72) 100%), url(${imageUrl})`,
        }}
      />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          {category ? (
            <Badge className="border-0 bg-amber-400/20 text-amber-200 hover:bg-amber-400/20">
              {category}
            </Badge>
          ) : null}
          <Badge
            variant="outline"
            className="border-white/15 bg-white/5 text-white/75"
          >
            {availability}
          </Badge>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">{date}</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">{title}</h3>
        </div>
        <p className="text-sm leading-7 text-white/62">{description}</p>
        <Link
          href={href}
          className="inline-flex items-center text-sm font-medium text-amber-300 transition hover:text-amber-200"
        >
          Apri evento
        </Link>
      </div>
    </article>
  );
}
