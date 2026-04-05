import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "@/components/public-shell";
import { SectionHeading } from "@/components/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import { gamePageHeroUrl } from "@/lib/design/media";
import { getPublishedGamePageSummaries } from "@/lib/gamestore/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Giochi",
  description:
    "Pagine dedicate ai trading card game e RPG al Mana Nero: Magic, One Piece, D&D, Riftbound, Flesh and Blood e altro.",
};

export default async function GiochiIndexPage() {
  const supabase = await createClient();
  const games = await getPublishedGamePageSummaries(supabase);

  return (
    <PublicShell>
      <main className="page-frame py-12">
        <SectionHeading
          eyebrow="Linee di gioco"
          title="Scegli la tua modalità."
          description="Ogni pagina raccoglie introduzione, formati di esempio e come ci trovi in negozio. I dettagli su date e premi restano nel calendario eventi."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {games.length === 0 ? (
            <p className="text-sm text-foreground/70">
              Nessuna pagina gioco pubblicata. Controlla più tardi o passa in fumetteria.
            </p>
          ) : (
            games.map((game) => {
              const img = gamePageHeroUrl(game.hero_image_path);
              const preview =
                game.intro?.replace(/\s+/g, " ").trim().slice(0, 160) ||
                `Scopri ${game.display_name} al Mana Nero.`;
              return (
                <Link key={game.slug} href={`/giochi/${game.slug}`} className="group block">
                  <Card className="h-full overflow-hidden border-border/70 bg-card/85 transition hover:border-primary/40 hover:shadow-md">
                    <div
                      className="relative h-40 w-full bg-muted"
                      style={{
                        backgroundImage: `linear-gradient(180deg, rgba(4,8,20,0.2) 0%, rgba(4,8,20,0.75) 100%), url(${img})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    />
                    <CardContent className="p-5">
                      {game.eyebrow ? (
                        <p className="text-[11px] uppercase tracking-[0.22em] text-foreground/45">
                          {game.eyebrow}
                        </p>
                      ) : null}
                      <h2 className="mt-2 text-xl font-semibold tracking-tight group-hover:text-primary">
                        {game.display_name}
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/70">{preview}</p>
                      <p className="mt-4 text-sm font-medium text-primary">Apri pagina →</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </main>
    </PublicShell>
  );
}
