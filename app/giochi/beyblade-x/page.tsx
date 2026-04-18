import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PublicShell } from "@/components/public-shell";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import beybladeArenaHero from "@/images/beyblade-arena-hero.webp";

export const metadata: Metadata = {
  title: "BeyBlade X — Tornei",
  description:
    "Arena Xtreme, burst, ranking e serate BeyBlade X al Mana Nero di Tradate. Testi dimostrativi — programma in aggiornamento.",
  alternates: { canonical: "/giochi/beyblade-x" },
};

export default function BeybladeXTournamentsPage() {
  return (
    <PublicShell>
      <main>
        {/* Solo elemento grafico: nessun testo sovrapposto */}
        <div className="relative w-full overflow-hidden border-b border-white/10">
          <div className="relative h-[min(52vh,580px)] w-full min-h-[200px] sm:h-[min(48vh,640px)]">
            <Image
              src={beybladeArenaHero}
              alt="Arena da battaglia BeyBlade — palco di gioco illuminate"
              fill
              priority
              className="object-cover object-center"
              sizes="100vw"
            />
          </div>
        </div>

        <div className="page-frame pb-12 pt-4 sm:pb-14 sm:pt-5">
          <header className="max-w-3xl border-b border-white/10 pb-8 sm:pb-10">
            <nav className="mb-3 text-sm text-white/55" aria-label="Percorso di navigazione">
              <Link href="/giochi" className="transition hover:text-white">
                Giochi e Tornei
              </Link>
              <span className="mx-2 text-white/35">/</span>
              <span className="text-white">BeyBlade X</span>
            </nav>
            <p className="text-[11px] uppercase tracking-[0.32em] text-amber-300">
              BeyBlade X · Arena Xtreme
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Xtreme battaglie in negozio: il tuo prossimo burst parte qui.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
              Testi dimostrativi per presentare l&apos;esperienza torneo al Mana Nero: combo
              launch, burst chain e tabellone ranking — presto date e premi reali sul
              calendario eventi.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-sm">
                <Link href="/events">Vedi eventi in programma</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-white/25 bg-white/5 px-7 text-sm text-white hover:bg-white/12 hover:text-white"
              >
                <Link href="/contact">Contatta lo staff</Link>
              </Button>
            </div>
          </header>

          <section className="mt-10 sm:mt-12">
            <SectionHeading
              eyebrow="Formato (esempio)"
              title="Come funziona un torneo BeyBlade X in serata"
              description="Struttura dimostrativa che potrai adattare quando pubblicheremo le iscrizioni ufficiali."
            />
            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              <Card className="glass-panel border-white/10">
                <CardContent className="space-y-3 p-6 text-sm leading-7 text-white/75">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/90">Fase 1</p>
                  <p className="text-lg font-semibold text-white">Swiss leggera</p>
                  <p>
                    Quattro turni da tre battaglie: ogni vittoria vale un punto burst, pareggio
                    contato come shoot-out singolo da 60 secondi (testo di esempio).
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-panel border-white/10">
                <CardContent className="space-y-3 p-6 text-sm leading-7 text-white/75">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200/90">Fase 2</p>
                  <p className="text-lg font-semibold text-white">Bracket top 8</p>
                  <p>
                    Elimination diretta best-of-3: stadium staff, countdown unificato e
                    check deck list prima del grid (placeholder regolamento).
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-panel border-white/10">
                <CardContent className="space-y-3 p-6 text-sm leading-7 text-white/75">
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/90">Premi demo</p>
                  <p className="text-lg font-semibold text-white">Burst loot table</p>
                  <p>
                    Booster omaggio per chi completa tre burst in una singola battaglia; trofeo
                    lampada mini per il primo classificato — solo copy dimostrativo.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="mt-10 sm:mt-12">
            <div className="grid gap-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 sm:p-10 lg:grid-cols-[1fr_1.05fr] lg:items-center">
              <div>
                <h2 className="text-2xl font-semibold text-white sm:text-3xl">Porta la tua combo</h2>
                <p className="mt-4 text-sm leading-relaxed text-white/75 sm:text-base">
                  Serate aperte ai launcher personalizzati entro i limiti regolamento ufficiale
                  BeyBlade X (testo di esempio). Lo staff verifica compatibilità mod e pezzi 3D
                  stampati prima del tavolo — niente stadium caricati a molla propria.
                </p>
              </div>
              <ul className="space-y-3 text-sm leading-relaxed text-white/75">
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  Check-in 30 minuti prima: numero giro libero in arena dimostrativa.
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  Cartellino player con QR verso questo sito per aggiornamenti live (mock).
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  Streaming amatoriale solo con consenso genitori per under 14 (placeholder).
                </li>
              </ul>
            </div>
          </section>
        </div>
      </main>
    </PublicShell>
  );
}
