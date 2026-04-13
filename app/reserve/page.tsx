import type { Metadata } from "next";
import { Suspense } from "react";

import { SearchParamsToast } from "@/components/search-params-toast";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8">
      <Suspense><SearchParamsToast /></Suspense>
      <h1 className="text-4xl font-semibold">Richiesta prodotto</h1>
      <Card className="mt-8 border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>Richiedi un prodotto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm leading-6 text-foreground/70">
            Non trovi quello che cerchi? Compila il modulo e ti faremo sapere
            appena il prodotto è disponibile in negozio.
          </p>

          {!user ? (
            <div className="rounded-2xl bg-secondary/70 p-5 text-sm text-foreground/72">
              Devi essere autenticato per inviare la richiesta.
              <div className="mt-3">
                <Link href="/auth/login" className="font-medium text-primary hover:underline">
                  Vai al login
                </Link>
              </div>
            </div>
          ) : (
            <form action={createProductRequest} className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="product_name">Prodotto</Label>
                <Input id="product_name" name="product_name" required />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Input id="category" name="category" placeholder="TCG, Board Game, Accessorio" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="quantity">Quantità</Label>
                  <Input id="quantity" name="quantity" min="1" step="1" type="number" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="desired_price">Prezzo desiderato</Label>
                <Input
                  id="desired_price"
                  name="desired_price"
                  min="0"
                  step="0.01"
                  type="number"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Note</Label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={5}
                  className="min-h-28 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="priority_flag"
                  name="priority_flag"
                  type="checkbox"
                  className="h-4 w-4 rounded border border-input"
                />
                <Label htmlFor="priority_flag" className="font-normal text-foreground/80">
                  Segna come priorità (preordine / urgenza)
                </Label>
              </div>

              <SubmitButton className="w-fit" pendingLabel="Invio richiesta...">
                Invia richiesta
              </SubmitButton>
            </form>
          )}
        </CardContent>
      </Card>

      {user ? (
        <Card className="mt-6 border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle>Le tue richieste recenti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {requests.length === 0 ? (
              <p className="text-sm leading-6 text-foreground/70">
                Ancora nessuna richiesta inviata.
              </p>
            ) : (
              requests.map((request) => (
                <div key={request.id} className="rounded-2xl bg-secondary/70 p-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium">{request.product_name}</p>
                    <span className="text-foreground/55">{formatProductRequestStatus(request.status)}</span>
                  </div>
                  <p className="mt-2 text-foreground/68">
                    {request.category || "Categoria libera"}
                    {request.priority_flag ? (
                      <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                        Priorità
                      </span>
                    ) : null}
                  </p>
                  {request.notes ? (
                    <p className="mt-2 text-foreground/68">{request.notes}</p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
