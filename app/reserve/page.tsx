import type { Metadata } from "next";
import { Suspense } from "react";

import { PublicShell } from "@/components/public-shell";
import { SearchParamsToast } from "@/components/search-params-toast";
import { SectionHeading } from "@/components/section-heading";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatProductRequestStatus, getUserProductRequests } from "@/lib/gamestore/data";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { createProductRequest } from "./actions";

export const metadata: Metadata = {
  title: "Richiesta prodotto",
  description:
    "Chiedi al Mana Nero di ordinare un prodotto: compila la richiesta e ricevi aggiornamenti sulla disponibilità.",
};

export default async function ReservePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const requests = user
    ? await getUserProductRequests(supabase, user.id)
    : [];

  return (
    <PublicShell>
      <Suspense><SearchParamsToast /></Suspense>
      <main className="page-frame py-12">
        <SectionHeading
          eyebrow="Richieste prodotto"
          title="Cerchi qualcosa di specifico? Te lo facciamo arrivare."
          description="Singles, novità in uscita, accessori o booster: compila la richiesta e ti aggiorniamo non appena è disponibile in negozio."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-white">Nuova richiesta</h2>
            <p className="mt-3 text-sm leading-7 text-white/65">
              Più dettagli ci dai, più velocemente possiamo rispondere. Lo staff
              risponde tipicamente entro 48 ore lavorative.
            </p>

            {!user ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm leading-7 text-white/72">
                Per inviare la richiesta serve essere autenticati.
                <div className="mt-3">
                  <Link
                    href="/auth/login?next=/reserve"
                    className="font-medium text-amber-300 transition hover:text-amber-200"
                  >
                    Accedi o crea un account →
                  </Link>
                </div>
              </div>
            ) : (
              <form action={createProductRequest} className="mt-6 grid gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="product_name" className="text-white/85">Prodotto</Label>
                  <Input id="product_name" name="product_name" required className="bg-white/5 text-white placeholder:text-white/35" />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="category" className="text-white/85">Categoria</Label>
                    <Input
                      id="category"
                      name="category"
                      placeholder="TCG, Board Game, Accessorio…"
                      className="bg-white/5 text-white placeholder:text-white/35"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="quantity" className="text-white/85">Quantità</Label>
                    <Input
                      id="quantity"
                      name="quantity"
                      min="1"
                      step="1"
                      type="number"
                      className="bg-white/5 text-white placeholder:text-white/35"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="desired_price" className="text-white/85">Prezzo desiderato</Label>
                  <Input
                    id="desired_price"
                    name="desired_price"
                    min="0"
                    step="0.01"
                    type="number"
                    className="bg-white/5 text-white placeholder:text-white/35"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="notes" className="text-white/85">Note</Label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={5}
                    className="min-h-28 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white shadow-sm placeholder:text-white/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-300/60"
                  />
                </div>

                <label className="flex items-center gap-3 text-sm text-white/80">
                  <input
                    id="priority_flag"
                    name="priority_flag"
                    type="checkbox"
                    className="h-4 w-4 rounded border border-white/30 bg-white/10 accent-amber-400"
                  />
                  Segna come priorità (preordine / urgenza)
                </label>

                <SubmitButton className="w-fit" pendingLabel="Invio richiesta...">
                  Invia richiesta
                </SubmitButton>
              </form>
            )}
          </section>

          <aside className="space-y-4">
            <div className="glass-panel rounded-[1.75rem] p-6 text-white">
              <h3 className="text-base font-semibold">Come funziona</h3>
              <ol className="mt-4 space-y-3 text-sm leading-7 text-white/70">
                <li>
                  <span className="mr-2 text-amber-300">1.</span>
                  Compila la richiesta con prodotto e dettagli utili.
                </li>
                <li>
                  <span className="mr-2 text-amber-300">2.</span>
                  Lo staff verifica fornitori e disponibilità.
                </li>
                <li>
                  <span className="mr-2 text-amber-300">3.</span>
                  Ti contattiamo via email per conferma e ritiro.
                </li>
              </ol>
            </div>

            {user ? (
              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-base font-semibold text-white">Le tue richieste recenti</h3>
                <div className="mt-4 space-y-3">
                  {requests.length === 0 ? (
                    <p className="text-sm leading-7 text-white/55">
                      Ancora nessuna richiesta inviata.
                    </p>
                  ) : (
                    requests.map((request) => (
                      <div key={request.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-medium text-white">{request.product_name}</p>
                          <span className="text-white/55">
                            {formatProductRequestStatus(request.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-white/60">
                          {request.category || "Categoria libera"}
                          {request.priority_flag ? (
                            <span className="ml-2 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-200">
                              Priorità
                            </span>
                          ) : null}
                        </p>
                        {request.notes ? (
                          <p className="mt-2 text-white/55">{request.notes}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </main>
    </PublicShell>
  );
}
