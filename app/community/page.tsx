import { CategoryCard } from "@/components/category-card";
import { PublicShell } from "@/components/public-shell";
import { SectionHeading } from "@/components/section-heading";
import { getCategoryImage } from "@/lib/design/media";

const communities = [
  {
    title: "Magic: The Gathering",
    description: "Draft, commander, constructed e pubblico competitivo con appuntamenti fissi.",
  },
  {
    title: "Pokemon TCG",
    description: "Scene accessibile per famiglie, nuovi ingressi e giocatori di lega.",
  },
  {
    title: "One Piece Card Game",
    description: "Comunità in crescita, ritmo torneo e forte identità di tavolo.",
  },
  {
    title: "Board Games",
    description: "Sessioni piu social, demo night e spazio per gruppi consolidati.",
  },
  {
    title: "Miniatures",
    description: "Community piu di nicchia con spazio per painting e gioco organizzato.",
  },
];

export default function CommunityPage() {
  return (
    <PublicShell>
      <main className="page-frame py-12">
        <SectionHeading
          eyebrow="Community"
          title="Ogni gioco ha la sua tribù."
          description="Da Magic a Pokemon, dai giochi da tavolo alle miniature: scopri la community che fa per te e unisciti alle serate."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {communities.map((community) => (
            <CategoryCard
              key={community.title}
              imageUrl={getCategoryImage(community.title)}
              title={community.title}
              description={community.description}
              href="/events"
            />
          ))}
        </div>
      </main>
    </PublicShell>
  );
}
