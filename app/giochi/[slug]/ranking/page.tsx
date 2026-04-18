import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicShell } from "@/components/public-shell";
import { Badge } from "@/components/ui/badge";
import {
  fetchLocalRanking,
  fetchLocalRankingSummary,
} from "@/lib/domain/tournaments";
import { formatDateTime, getPublishedGamePageBySlug } from "@/lib/gamestore/data";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const page = await getPublishedGamePageBySlug(supabase, slug);
  const title = page ? `Classifica locale · ${page.display_name}` : "Classifica locale";
  return {
    title,
    description:
      "Classifica dei tornei interni Mana Nero. Indipendente dalle piattaforme ufficiali, costruita con i risultati registrati dallo staff.",
    alternates: { canonical: `/giochi/${slug}/ranking` },
  };
}

const podiumStyle: Record<number, string> = {
  1: "from-amber-300/30 to-amber-500/15 ring-amber-300/40",
  2: "from-zinc-200/25 to-zinc-300/10 ring-zinc-200/40",
  3: "from-orange-300/25 to-orange-500/10 ring-orange-300/40",
};

const medalLabel: Record<number, string> = {
  1: "Oro",
  2: "Argento",
  3: "Bronzo",
};

function formatPoints(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "");
}

export default async function GameRankingPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const page = await getPublishedGamePageBySlug(supabase, slug);
  if (!page) notFound();

  const [ranking, summary] = await Promise.all([
    fetchLocalRanking(supabase, slug, 50),
    fetchLocalRankingSummary(supabase, slug),
  ]);

  const podium = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  return (
    <PublicShell>
      <main>
        <div className="relative w-full overflow-hidden border-b border-white/10">
          <div className="page-frame py-12 sm:py-16">
            <nav className="mb-3 text-sm text-white/55">
              <Link href="/" className="transition hover:text-white">
                Home
              </Link>
              <span className="mx-2 text-white/35">/</span>
              <Link href="/giochi" className="transition hover:text-white">
                Giochi
              </Link>
              <span className="mx-2 text-white/35">/</span>
              <Link
                href={`/giochi/${slug}`}
                className="transition hover:text-white"
              >
                {page.display_name}
              </Link>
              <span className="mx-2 text-white/35">/</span>
              <span className="text-white">Classifica</span>
            </nav>
            <p className="text-[11px] uppercase tracking-[0.32em] text-amber-300">
              Community Mana Nero
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Classifica locale · {page.display_name}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
              Una classifica dei nostri tornei interni che vive accanto alle
              piattaforme ufficiali (Wizards Companion, Bandai TCG+, Play!
              Pokémon, WBO). Niente login obbligatori su servizi esterni:
              registriamo i risultati al tavolo, qui trovi sempre l&apos;ultima
              stagione.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/70">
              <Badge variant="outline" className="border-white/25 bg-white/5 text-white">
                {summary.total_players} giocatori
              </Badge>
              <Badge variant="outline" className="border-white/25 bg-white/5 text-white">
                {summary.total_results} risultati registrati
              </Badge>
              {summary.last_event_at ? (
                <Badge variant="outline" className="border-white/25 bg-white/5 text-white">
                  Ultimo evento {formatDateTime(summary.last_event_at)}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <section className="page-frame pb-16 pt-10 sm:pt-12">
          {ranking.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
              <h2 className="text-xl font-semibold text-white">
                Classifica in costruzione
              </h2>
              <p className="mt-3 text-sm text-white/65">
                Non sono ancora stati registrati risultati per {page.display_name}.
                Partecipa al prossimo torneo o segui gli aggiornamenti dallo store.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link
                  href="/events"
                  className="rounded-full border border-white/25 bg-white/5 px-5 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  Vedi gli eventi
                </Link>
                <Link
                  href={`/giochi/${slug}`}
                  className="rounded-full bg-amber-300/90 px-5 py-2 text-sm text-zinc-950 transition hover:bg-amber-200"
                >
                  Pagina del gioco
                </Link>
              </div>
            </div>
          ) : (
            <>
              {podium.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  {podium.map((row, idx) => {
                    const place = idx + 1;
                    return (
                      <div
                        key={row.player_key}
                        className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b p-6 ring-1 ${podiumStyle[place]}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] uppercase tracking-[0.32em] text-white/65">
                            {medalLabel[place]}
                          </span>
                          <span className="text-3xl font-semibold tabular-nums text-white">
                            #{place}
                          </span>
                        </div>
                        <p className="mt-4 text-2xl font-semibold text-white">
                          {row.display_name}
                        </p>
                        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-white/70">
                          <div>
                            <dt className="uppercase tracking-[0.2em] text-white/45">Punti</dt>
                            <dd className="mt-1 text-base font-semibold text-white">
                              {formatPoints(row.total_points)}
                            </dd>
                          </div>
                          <div>
                            <dt className="uppercase tracking-[0.2em] text-white/45">Best</dt>
                            <dd className="mt-1 text-base font-semibold text-white">
                              #{row.best_finish}
                            </dd>
                          </div>
                          <div>
                            <dt className="uppercase tracking-[0.2em] text-white/45">Eventi</dt>
                            <dd className="mt-1 text-base font-semibold text-white">
                              {row.events_played}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {rest.length > 0 ? (
                <div className="mt-10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                  <table className="w-full text-left text-sm text-white/85">
                    <thead className="bg-white/[0.04] text-[11px] uppercase tracking-[0.18em] text-white/55">
                      <tr>
                        <th className="px-5 py-3">#</th>
                        <th className="px-5 py-3">Giocatore</th>
                        <th className="px-5 py-3 text-right">Punti</th>
                        <th className="px-5 py-3 text-right">Best</th>
                        <th className="px-5 py-3 text-right">Eventi</th>
                        <th className="px-5 py-3 text-right">Ultimo evento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rest.map((row, idx) => (
                        <tr
                          key={row.player_key}
                          className="border-t border-white/[0.06] hover:bg-white/[0.02]"
                        >
                          <td className="px-5 py-3 tabular-nums text-white/65">
                            {idx + 4}
                          </td>
                          <td className="px-5 py-3 font-medium text-white">
                            {row.display_name}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums">
                            {formatPoints(row.total_points)}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums">
                            #{row.best_finish}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums">
                            {row.events_played}
                          </td>
                          <td className="px-5 py-3 text-right text-white/65">
                            {row.last_event_at
                              ? formatDateTime(row.last_event_at)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <p className="mt-8 text-xs text-white/55">
                I dati sono di proprietà del negozio: registriamo i risultati al
                tavolo per costruire una community indipendente dalle piattaforme
                ufficiali. Vuoi collegare i tuoi account (DCI, BNID, WBO,
                Discord)? Vai al tuo{" "}
                <Link href="/protected" className="underline hover:text-white">
                  profilo
                </Link>
                .
              </p>
            </>
          )}
        </section>
      </main>
    </PublicShell>
  );
}
