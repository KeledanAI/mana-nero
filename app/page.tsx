import type { Metadata } from "next";
import Link from "next/link";

import { CategoryCard } from "@/components/category-card";
import { EventCard } from "@/components/event-card";
import { NewsCard } from "@/components/news-card";
import { PublicShell } from "@/components/public-shell";
import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SocialLinks } from "@/components/social-links";
import {
  eventCardImageUrl,
  getCategoryImage,
  newsCardImageUrl,
  siteMedia,
} from "@/lib/design/media";
import { formatDateTime, getRecentPosts, getUpcomingEvents } from "@/lib/gamestore/data";
import { createClient } from "@/lib/supabase/server";
import { CalendarDays, Clock, MapPin, Phone, Users } from "lucide-react";

export const metadata: Metadata = {
  title: { absolute: "Mana Nero Fumetteria — Tradate" },
  description:
    "Fumetti, giochi di carte collezionabili, giochi da tavolo ed eventi. Il cuore ludico di Tradate.",
};

const categories: {
  title: string;
  description: string;
  href?: string;
  eyebrow?: string;
  linkLabel?: string;
}[] = [
  {
    title: "BeyBlade X",
    description: "Arena Xtreme in fumetteria: burst, ranking e tornei dimostrativi — scopri il programma.",
    href: "/giochi/beyblade-x",
    eyebrow: "Torneo",
    linkLabel: "Apri BeyBlade X",
  },
  {
    title: "Magic: The Gathering",
    description: "Draft, commander, constructed e serate tornei per i giocatori più assidui.",
    href: "/giochi/magic-the-gathering",
  },
  {
    title: "Pokemon TCG",
    description: "Leghe locali, eventi per famiglie e tornei per la community in crescita.",
    href: "/giochi/pokemon-tcg",
  },
  {
    title: "One Piece Card Game",
    description: "Serate competitive e tavoli dedicati alla community più attiva del momento.",
    href: "/giochi/one-piece",
  },
  {
    title: "Board Games",
    description: "Demo, tavoli aperti e serate per chi vuole scoprire nuovi giochi in compagnia.",
    href: "/giochi/board-games",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const [featuredEvents, recentPosts] = await Promise.all([
    getUpcomingEvents(supabase, 3),
    getRecentPosts(supabase, 3),
  ]);

  const nextEvent = featuredEvents[0] ?? null;

  return (
    <PublicShell>
      <main>
        {/* ── Hero ── */}
        <section className="page-frame pt-8 sm:pt-10">
          <div
            className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(6,10,22,0.92) 0%, rgba(6,10,22,0.66) 44%, rgba(6,10,22,0.28) 100%), url(${siteMedia.hero})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,210,112,0.28),transparent_32%)]" />
            <div className="relative grid min-h-[38rem] content-end gap-10 p-8 sm:p-10 lg:grid-cols-[1.05fr_0.95fr] lg:content-center lg:p-14">
              <div className="max-w-3xl">
                <Badge className="border-0 bg-white/10 px-4 py-1.5 text-white hover:bg-white/10">
                  Fumetteria · Giochi · Tornei
                </Badge>
                <h1 className="mt-6 text-5xl font-semibold leading-[0.92] tracking-tight text-white sm:text-6xl lg:text-7xl">
                  Il tuo posto al tavolo ti aspetta.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-8 text-white/74 sm:text-lg">
                  Serate di gioco, tornei, nuove uscite e una community che cresce
                  ogni settimana. Mana Nero è il punto di riferimento per i
                  giocatori di Tradate e dintorni.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button asChild size="lg" className="h-12 rounded-full px-7 text-sm">
                    <Link href="/events">Scopri gli eventi</Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-full border-white/15 bg-white/5 px-7 text-sm text-white hover:bg-white/12 hover:text-white"
                  >
                    <Link href="/reserve">Richiedi un prodotto</Link>
                  </Button>
                </div>
              </div>

              {/* ── Prossimo evento ── */}
              <div className="grid gap-4 self-end lg:justify-self-end">
                <Card className="glass-panel rounded-[1.5rem] text-white shadow-[0_24px_80px_-32px_rgba(0,0,0,0.9)]">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {nextEvent ? "Prossimo evento" : "Prossime serate"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-5">
                    {nextEvent ? (
                      <>
                        <div className="flex items-start gap-4">
                          <CalendarDays className="mt-1 h-5 w-5 text-amber-300" />
                          <div>
                            <p className="font-medium">{nextEvent.title}</p>
                            <p className="text-sm leading-6 text-white/65">
                              {formatDateTime(nextEvent.starts_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4">
                          <Users className="mt-1 h-5 w-5 text-cyan-300" />
                          <div>
                            <p className="font-medium">{nextEvent.capacity} posti</p>
                            <p className="text-sm leading-6 text-white/65">
                              {nextEvent.event_categories?.name || nextEvent.game_type || "Serata giochi"}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`/events/${nextEvent.slug}`}
                          className="inline-flex text-sm font-medium text-amber-300 transition hover:text-amber-200"
                        >
                          Prenota il tuo posto →
                        </Link>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-4">
                          <CalendarDays className="mt-1 h-5 w-5 text-amber-300" />
                          <div>
                            <p className="font-medium">Eventi in arrivo</p>
                            <p className="text-sm leading-6 text-white/65">
                              Tornei, serate demo e gioco libero ogni settimana.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4">
                          <Users className="mt-1 h-5 w-5 text-cyan-300" />
                          <div>
                            <p className="font-medium">Community locale</p>
                            <p className="text-sm leading-6 text-white/65">
                              Unisciti ai giocatori di Magic, Pokemon, One Piece e giochi da tavolo.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4">
                          <MapPin className="mt-1 h-5 w-5 text-emerald-300" />
                          <div>
                            <p className="font-medium">Via A. Volta 16, Tradate</p>
                            <p className="text-sm leading-6 text-white/65">
                              Passa a trovarci in negozio!
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* ── Eventi in evidenza ── */}
        <section className="page-frame mt-20">
          <SectionHeading
            eyebrow="Eventi in programma"
            title="Le prossime serate al Mana Nero."
            description="Tornei, serate demo, gioco libero e tanto altro. Scopri cosa succede questa settimana e prenota il tuo posto."
          />
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {featuredEvents.length === 0 ? (
              <Card className="glass-panel lg:col-span-3">
                <CardHeader>
                  <CardTitle className="text-white">Nessun evento in programma</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-7 text-white/62">
                  Stiamo preparando le prossime serate. Torna presto o seguici sui
                  social per restare aggiornato!
                </CardContent>
              </Card>
            ) : null}
            {featuredEvents.map((event, index) => (
              <EventCard
                key={event.id}
                imageUrl={eventCardImageUrl(event.cover_image_path, event.slug, index)}
                title={event.title}
                description={event.description || "Dettagli evento in arrivo."}
                date={formatDateTime(event.starts_at)}
                availability={`${event.capacity} posti`}
                href={`/events/${event.slug}`}
                category={event.event_categories?.name || event.game_type}
              />
            ))}
          </div>
        </section>

        {/* ── News ── */}
        <section className="page-frame mt-20">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <SectionHeading
              eyebrow="Ultime novità"
              title="Novità, arrivi e aggiornamenti dal negozio."
              description="Nuove uscite, risultati dei tornei e comunicazioni dallo staff."
            />
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-sm leading-7 text-white/62">
              Seguici per non perderti le release più attese, i recap delle serate
              e le novità in arrivo sugli scaffali del Mana Nero.
            </div>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {recentPosts.length === 0 ? (
              <Card className="glass-panel lg:col-span-3">
                <CardHeader>
                  <CardTitle className="text-white">Nessuna novità al momento</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-7 text-white/62">
                  Le prime news arriveranno presto. Resta connesso!
                </CardContent>
              </Card>
            ) : null}
            {recentPosts.map((post, index) => (
              <NewsCard
                key={post.id}
                imageUrl={newsCardImageUrl(post.cover_image_path, post.slug, index)}
                title={post.title}
                description={
                  post.body?.slice(0, 150) || "Apri il dettaglio per leggere l'aggiornamento completo."
                }
                meta={post.published_at ? formatDateTime(post.published_at) : "News"}
                href={`/news/${post.slug}`}
              />
            ))}
          </div>
        </section>

        {/* ── Categorie gioco ── */}
        <section className="page-frame mt-20">
          <SectionHeading
            eyebrow="I nostri giochi"
            title="Ogni community ha il suo spazio."
            description="Da Magic a Pokemon, dai giochi da tavolo a One Piece: trova la tua tribù e unisciti alle serate."
          />
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {categories.map((category) => (
              <CategoryCard
                key={category.title}
                imageUrl={getCategoryImage(category.title)}
                title={category.title}
                description={category.description}
                href={category.href ?? "/giochi"}
                eyebrow={category.eyebrow}
                linkLabel={category.linkLabel}
              />
            ))}
          </div>
        </section>

        {/* ── Il negozio ── */}
        <section className="page-frame mt-20">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div
              className="overflow-hidden rounded-[2rem] border border-white/10"
              style={{
                backgroundImage: `linear-gradient(90deg, rgba(8,10,21,0.9) 0%, rgba(8,10,21,0.55) 100%), url(${siteMedia.store})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="flex h-full flex-col justify-end p-8 sm:p-10">
                <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/72">
                  Il negozio
                </p>
                <h2 className="mt-4 max-w-xl text-4xl font-semibold text-white">
                  Un luogo dove creatività, socialità e divertimento si incontrano.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-8 text-white/68">
                  Serate introduttive per chi è alle prime armi, tornei per i
                  veterani e tavoli aperti per chi vuole semplicemente divertirsi.
                  Ti aspettiamo al Mana Nero.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <Card className="glass-panel rounded-[1.75rem] text-white">
                <CardContent className="flex gap-4 p-6">
                  <MapPin className="mt-1 h-5 w-5 text-amber-300" />
                  <div>
                    <p className="font-medium">Dove siamo</p>
                    <p className="mt-2 text-sm leading-7 text-white/62">
                      Via Alessandro Volta 16, 21049 Tradate (VA)
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-panel rounded-[1.75rem] text-white">
                <CardContent className="flex gap-4 p-6">
                  <Clock className="mt-1 h-5 w-5 text-cyan-300" />
                  <div>
                    <p className="font-medium">Orari</p>
                    <p className="mt-2 text-sm leading-7 text-white/62">
                      Mar–Ven: 13:30–19:30, serate 21–00<br />
                      Sab: 10–12, 13:30–19:30 · Dom: 13:30–19:30
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-panel rounded-[1.75rem] text-white">
                <CardContent className="flex gap-4 p-6">
                  <Phone className="mt-1 h-5 w-5 text-emerald-300" />
                  <div>
                    <p className="font-medium">Contatti</p>
                    <p className="mt-2 text-sm leading-7 text-white/62">
                      0331 171 2653 · mananerofumetteria@gmail.com
                    </p>
                  </div>
                </CardContent>
              </Card>
              <SocialLinks size="lg" className="justify-center pt-2" />
            </div>
          </div>
        </section>

        {/* ── Newsletter CTA ── */}
        <section className="page-frame mt-20 pb-10">
          <div
            className="overflow-hidden rounded-[2rem] border border-white/10"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(6,10,22,0.92) 0%, rgba(6,10,22,0.68) 55%, rgba(6,10,22,0.45) 100%), url(${siteMedia.newsletter})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="grid gap-6 p-8 sm:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-amber-300/72">
                  Resta aggiornato
                </p>
                <h2 className="mt-4 text-4xl font-semibold text-white">
                  Non perderti le prossime serate e le novità in negozio.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-8 text-white/68">
                  Iscriviti alla newsletter per ricevere gli aggiornamenti su eventi,
                  nuove uscite e offerte speciali.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
                <div className="grid gap-3">
                  <Button asChild className="h-12 rounded-full">
                    <Link href="/protected">Gestisci le tue preferenze</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-12 rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  >
                    <Link href="/news">Leggi le ultime novità</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
