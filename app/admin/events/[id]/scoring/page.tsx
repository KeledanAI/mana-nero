import Link from "next/link";
import { notFound } from "next/navigation";

import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireUserWithRole } from "@/lib/gamestore/authz";
import {
  getEventCategoryForEvent,
  getEventRegistrationsForStaff,
  getTournamentResultsForEventStaff,
} from "@/lib/gamestore/data";

import {
  deleteTournamentResultAction,
  recordTournamentResultAction,
} from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const errorMessages: Record<string, string> = {
  display_name_required: "Inserisci il nome del giocatore (anche walk-in).",
  final_rank_invalid: "Il rank finale deve essere un intero ≥ 1.",
  record_failed: "Salvataggio risultato non riuscito.",
  delete_failed: "Eliminazione del risultato non riuscita.",
  missing_event_id: "Evento mancante nel form.",
  missing_ids: "Identificativi mancanti.",
};

const successMessages: Record<string, string> = {
  result_saved: "Risultato salvato.",
  result_removed: "Risultato rimosso.",
};

export default async function AdminEventScoringPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const { supabase } = await requireUserWithRole("staff");

  const [{ data: event }, registrations, results, category] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, slug, starts_at, capacity, status")
      .eq("id", id)
      .maybeSingle(),
    getEventRegistrationsForStaff(supabase, id),
    getTournamentResultsForEventStaff(supabase, id),
    getEventCategoryForEvent(supabase, id),
  ]);

  if (!event) notFound();

  const errorCode = firstParam(query.error);
  const successCode = firstParam(query.success);

  const checkedIn = registrations.filter((r) => r.status === "checked_in");
  const confirmed = registrations.filter((r) => r.status === "confirmed");
  const orderedRegistrations = [...checkedIn, ...confirmed];
  const recordedProfileIds = new Set(results.map((r) => r.profile_id).filter(Boolean));
  const totalParticipants = Math.max(
    checkedIn.length || confirmed.length || results.length,
    results.length,
    1,
  );

  return (
    <section className="grid gap-6">
      <nav className="flex flex-wrap items-center gap-3 text-sm text-foreground/65">
        <Link
          href={`/admin/events/${event.id}`}
          className="font-medium text-primary hover:underline"
        >
          ← Torna alla scheda evento
        </Link>
        <span className="text-foreground/35">·</span>
        <Link
          href={`/admin/events/${event.id}/scoring/import`}
          className="font-medium text-primary hover:underline"
        >
          Importa risultati da CSV
        </Link>
      </nav>

      <Card className="border-border/70 bg-card/85">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Scoring torneo</Badge>
            {category ? <Badge variant="outline">{category.name}</Badge> : null}
            <Badge variant="outline">Capienza {event.capacity}</Badge>
          </div>
          <CardTitle className="text-2xl">{event.title}</CardTitle>
          <p className="text-sm text-foreground/65">
            Registra l&apos;esito del torneo. I risultati alimentano la classifica
            locale di{" "}
            {category ? (
              <Link
                href={`/giochi/${category.slug}/ranking`}
                className="font-medium text-primary hover:underline"
              >
                /giochi/{category.slug}/ranking
              </Link>
            ) : (
              <span>la categoria gioco</span>
            )}
            .
          </p>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-foreground/75">
          {errorCode ? (
            <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
              {errorMessages[errorCode] ?? errorCode}
            </p>
          ) : null}
          {successCode ? (
            <p className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-emerald-200">
              {successMessages[successCode] ?? successCode}
            </p>
          ) : null}
          <p>
            Hai{" "}
            <span className="font-medium text-foreground">
              {orderedRegistrations.length}
            </span>{" "}
            partecipanti registrati ({checkedIn.length} con check-in confermato).
            Risultati attualmente registrati:{" "}
            <span className="font-medium text-foreground">{results.length}</span>.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>Aggiungi / aggiorna risultato</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={recordTournamentResultAction} className="grid gap-4">
            <input type="hidden" name="event_id" value={event.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="profile_id">Partecipante registrato</Label>
                <select
                  id="profile_id"
                  name="profile_id"
                  defaultValue=""
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— Walk-in (solo nome) —</option>
                  {orderedRegistrations.map((r) => {
                    const label =
                      r.profiles?.full_name ?? r.profiles?.email ?? r.user_id.slice(0, 8);
                    const already = recordedProfileIds.has(r.user_id);
                    return (
                      <option key={r.id} value={r.user_id}>
                        {label}
                        {r.status === "checked_in" ? " · check-in" : ""}
                        {already ? " · già registrato" : ""}
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-foreground/55">
                  Selezionando un partecipante registrato il record viene
                  associato al profilo (RLS owner-readable) e si aggiorna se già
                  esistente.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="display_name">Nome a tabellone</Label>
                <Input
                  id="display_name"
                  name="display_name"
                  required
                  placeholder="es. Mario Rossi"
                />
                <p className="text-xs text-foreground/55">
                  Sempre obbligatorio: serve in classifica anche per walk-in.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="final_rank">Rank finale</Label>
                <Input
                  id="final_rank"
                  name="final_rank"
                  type="number"
                  min={1}
                  required
                  placeholder="1"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="total_participants">Partecipanti totali</Label>
                <Input
                  id="total_participants"
                  name="total_participants"
                  type="number"
                  min={1}
                  defaultValue={totalParticipants}
                />
                <p className="text-xs text-foreground/55">
                  Usato per calcolare i punti normalizzati 0–1 se non li fornisci esplicitamente.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="points">Punti (override)</Label>
                <Input
                  id="points"
                  name="points"
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="es. 1.00"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="wins">Vittorie</Label>
                <Input id="wins" name="wins" type="number" min={0} defaultValue={0} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="losses">Sconfitte</Label>
                <Input id="losses" name="losses" type="number" min={0} defaultValue={0} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="draws">Pareggi</Label>
                <Input id="draws" name="draws" type="number" min={0} defaultValue={0} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="format">Formato (opzionale)</Label>
                <Input
                  id="format"
                  name="format"
                  placeholder="es. Modern, Standard, Expanded, ECC"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="external_handle">Handle esterno (opzionale)</Label>
                <Input
                  id="external_handle"
                  name="external_handle"
                  placeholder="es. DCI, BNID, WBO username"
                />
              </div>
            </div>

            <div>
              <SubmitButton>Salva risultato</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>Risultati registrati</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {results.length === 0 ? (
            <p className="text-sm text-foreground/60">
              Nessun risultato ancora registrato per questo evento.
            </p>
          ) : (
            <ul className="grid gap-2">
              {results.map((row) => {
                const profileLabel =
                  row.profiles?.full_name ?? row.profiles?.email ?? "Walk-in";
                return (
                  <li
                    key={row.id}
                    className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        #{row.final_rank} · {row.display_name}
                      </p>
                      <p className="text-xs text-foreground/55">
                        {row.profile_id ? (
                          <>Profilo: {profileLabel}</>
                        ) : (
                          <>Walk-in</>
                        )}
                        {" · "}
                        W/L/D {row.wins}/{row.losses}/{row.draws} · {row.points} pt
                        {row.format ? ` · ${row.format}` : ""}
                      </p>
                    </div>
                    <form action={deleteTournamentResultAction}>
                      <input type="hidden" name="result_id" value={row.id} />
                      <input type="hidden" name="event_id" value={event.id} />
                      <SubmitButton variant="ghost" className="text-destructive">
                        Rimuovi
                      </SubmitButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
