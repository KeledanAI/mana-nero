import type { Metadata } from "next";

import { CategoryCard } from "@/components/category-card";
import { PublicShell } from "@/components/public-shell";
import { SectionHeading } from "@/components/section-heading";
import { gamePageHeroUrl, getCategoryImage } from "@/lib/design/media";
import { getPublishedGamePageSummaries } from "@/lib/gamestore/data";
import { createClient } from "@/lib/supabase/server";

type GameTile = {
  title: string;
  description: string;
  href: string;
  imageUrl: string;
  eyebrow?: string;
  linkLabel?: string;
};

/** Categorie senza ancora una pagina silo CMS: restano collegate al calendario eventi. */
const staticGames: GameTile[] = [
  {
    title: "BeyBlade X",
    description:
      "Arena Xtreme, burst a raffica e ranking locale: tornei amatoriali, deck list consigliate e serate dedicate al nuovo sistema.",
    href: "/giochi/beyblade-x",
    imageUrl: getCategoryImage("BeyBlade X"),
    eyebrow: "Torneo",
    linkLabel: "Apri BeyBlade X",
  },
  {
    title: "Miniatures",
    description: "Community più di nicchia con spazio per painting e gioco organizzato.",
    href: "/events",
    imageUrl: getCategoryImage("Miniatures"),
  },
];

export const metadata: Metadata = {
  title: "Giochi e Tornei",
  description:
    "Magic, Pokémon, BeyBlade X, One Piece, D&D, Riftbound, Flesh and Blood, board game e miniature: programma tornei e community al Mana Nero.",
  alternates: { canonical: "/giochi" },
};

export default async function GiochiHubPage() {
  const supabase = await createClient();
  const hubGames = await getPublishedGamePageSummaries(supabase);

  const cmsTiles: GameTile[] = hubGames.map((g) => ({
    title: g.display_name,
    description:
      g.intro?.replace(/\s+/g, " ").trim() ||
      `Hub dedicato a ${g.display_name}: formati, spazio in negozio e collegamenti agli eventi.`,
    href: `/giochi/${g.slug}`,
    imageUrl: gamePageHeroUrl(g.hero_image_path),
    eyebrow: g.eyebrow ?? "Linea di gioco",
    linkLabel: "Apri pagina",
  }));

  const games: GameTile[] = [staticGames[0], ...cmsTiles, ...staticGames.slice(1)];

  return (
    <PublicShell>
      <main className="page-frame py-12">
        <SectionHeading
          eyebrow="Giochi e Tornei"
          title="Dal tavolo all'arena: scegli il tuo formato."
          description="TCG, miniature, giochi da tavolo e BeyBlade X: ogni linea ha spazi dedicati, staff in negozio e calendario di serate. Le pagine per gioco sono aggiornabili dallo staff; prenota dal sito o passa in fumetteria."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {games.map((game) => (
            <CategoryCard
              key={`${game.href}-${game.title}`}
              imageUrl={game.imageUrl}
              title={game.title}
              description={game.description}
              href={game.href}
              eyebrow={game.eyebrow}
              linkLabel={game.linkLabel}
            />
          ))}
        </div>
      </main>
    </PublicShell>
  );
}
