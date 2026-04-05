import type { Metadata } from "next";

import { CategoryCard } from "@/components/category-card";
import { PublicShell } from "@/components/public-shell";
import { SectionHeading } from "@/components/section-heading";
import { getCategoryImage } from "@/lib/design/media";

type GameTile = {
  title: string;
  description: string;
  href: string;
  eyebrow?: string;
  linkLabel?: string;
};

const games: GameTile[] = [
  {
    title: "BeyBlade X",
    description:
      "Arena Xtreme, burst a raffica e ranking locale: tornei amatoriali, deck list consigliate e serate dedicate al nuovo sistema.",
    href: "/community/beyblade-x",
    eyebrow: "Torneo",
    linkLabel: "Apri BeyBlade X",
  },
  {
    title: "Magic: The Gathering",
    description: "Draft, commander, constructed e pubblico competitivo con appuntamenti fissi.",
    href: "/events",
  },
  {
    title: "Pokemon TCG",
    description: "Scene accessibile per famiglie, nuovi ingressi e giocatori di lega.",
    href: "/events",
  },
  {
    title: "One Piece Card Game",
    description: "Comunità in crescita, ritmo torneo e forte identità di tavolo.",
    href: "/events",
  },
  {
    title: "Board Games",
    description: "Sessioni più sociali, demo night e spazio per gruppi consolidati.",
    href: "/events",
  },
  {
    title: "Miniatures",
    description: "Community più di nicchia con spazio per painting e gioco organizzato.",
    href: "/events",
  },
];

export const metadata: Metadata = {
  title: "Giochi e Tornei",
  description:
    "Magic, Pokémon, BeyBlade X, One Piece, board game e miniature: programma tornei e community al Mana Nero.",
};

export default function GamesAndTournamentsPage() {
  return (
    <PublicShell>
      <main className="page-frame py-12">
        <SectionHeading
          eyebrow="Giochi e Tornei"
          title="Dal tavolo all'arena: scegli il tuo formato."
          description="TCG, miniature, giochi da tavolo e BeyBlade X: ogni linea ha spazi dedicati, staff in negozio e calendario di serate. Prenota dal sito o passa in fumetteria."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {games.map((game) => (
            <CategoryCard
              key={game.title}
              imageUrl={getCategoryImage(game.title)}
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
