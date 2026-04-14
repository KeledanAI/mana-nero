import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatForDatetimeLocalInput, getPublishedEvents } from "@/lib/gamestore/data";
import { requireUserWithRole } from "@/lib/gamestore/authz";
import { deleteEvent, saveEvent } from "../actions";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminEventsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const editId = firstParam(params.edit);
  const { supabase } = await requireUserWithRole("staff");

  const [{ data: categories }, { data: allEvents }, publishedEvents, { data: editingEvent }] =
    await Promise.all([
      supabase.from("event_categories").select("id, name, slug").order("name"),
      supabase
        .from("events")
        .select("id, title, slug, status, starts_at, capacity")
        .order("starts_at", { ascending: true }),
      getPublishedEvents(supabase),
      editId
        ? supabase
            .from("events")
            .select(
              "id, title, slug, description, game_type, starts_at, ends_at, capacity, price_display, price_cents, deposit_cents, currency, status, category_id, cover_image_path, check_in_early_days, check_in_late_hours",
            )
            .eq("id", editId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  return (
    <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle>{editingEvent ? "Modifica evento" : "Nuovo evento"}</CardTitle>
            {editingEvent ? (
              <Link
                href="/admin/events"
                className="text-sm font-medium text-primary hover:underline"
              >
                Annulla modifica
              </Link>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <form action={saveEvent} className="grid gap-4" key={editingEvent?.id ?? "new"}>
            {editingEvent ? <input type="hidden" name="id" value={editingEvent.id} /> : null}
            <div className="grid gap-2">
              <Label htmlFor="title">Titolo</Label>
              <Input id="title" name="title" required defaultValue={editingEvent?.title ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" required defaultValue={editingEvent?.slug ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descrizione</Label>
              <textarea
                id="description"
                name="description"
                rows={5}
                className="min-h-28 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                defaultValue={editingEvent?.description ?? ""}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="game_type">Game type</Label>
                <Input id="game_type" name="game_type" defaultValue={editingEvent?.game_type ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="capacity">Capienza</Label>
                <Input
                  id="capacity"
                  name="capacity"
                  min="1"
                  step="1"
                  type="number"
                  required
                  defaultValue={editingEvent?.capacity ?? ""}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="starts_at">Inizio</Label>
                <Input
                  id="starts_at"
                  name="starts_at"
                  type="datetime-local"
                  required
                  defaultValue={
                    editingEvent?.starts_at
                      ? formatForDatetimeLocalInput(editingEvent.starts_at)
                      : ""
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ends_at">Fine</Label>
                <Input
                  id="ends_at"
                  name="ends_at"
                  type="datetime-local"
                  defaultValue={
                    editingEvent?.ends_at ? formatForDatetimeLocalInput(editingEvent.ends_at) : ""
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="price_display">Prezzo esposto</Label>
                <Input
                  id="price_display"
                  name="price_display"
                  placeholder="10 EUR, Gratis, 5 EUR deposito"
                  defaultValue={editingEvent?.price_display ?? ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Stato</Label>
                <select
                  id="status"
                  name="status"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  defaultValue={editingEvent?.status ?? "draft"}
                >
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="price_cents">Prezzo (centesimi, Stripe)</Label>
                <Input
                  id="price_cents"
                  name="price_cents"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="es. 1500 = 15 EUR"
                  defaultValue={
                    editingEvent?.price_cents != null ? String(editingEvent.price_cents) : ""
                  }
                />
                <p className="text-xs text-foreground/60">
                  Se &gt; 0 (o deposito &gt; 0), la prenotazione resta in attesa di pagamento fino al checkout.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="deposit_cents">Deposito (centesimi)</Label>
                <Input
                  id="deposit_cents"
                  name="deposit_cents"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="opzionale, ha priorità sul prezzo"
                  defaultValue={
                    editingEvent?.deposit_cents != null
                      ? String(editingEvent.deposit_cents)
                      : ""
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Valuta ISO</Label>
                <Input
                  id="currency"
                  name="currency"
                  maxLength={3}
                  placeholder="eur"
                  defaultValue={editingEvent?.currency ?? "eur"}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cover_image_path">Percorso immagine (bucket)</Label>
              <Input
                id="cover_image_path"
                name="cover_image_path"
                placeholder="events/my-event/cover.jpg"
                defaultValue={editingEvent?.cover_image_path ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cover_image">Carica nuova immagine</Label>
              <Input id="cover_image" name="cover_image" type="file" accept="image/jpeg,image/png,image/webp" />
              <p className="text-xs text-foreground/60">JPG/PNG/WEBP, max 5MB. Se carichi un file sovrascrive il percorso manuale.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="check_in_early_days">Check-in self-serve: giorni max prima dell&apos;inizio</Label>
                <Input
                  id="check_in_early_days"
                  name="check_in_early_days"
                  type="number"
                  min={0}
                  max={60}
                  placeholder="Default 8 se vuoto"
                  defaultValue={
                    editingEvent?.check_in_early_days != null
                      ? String(editingEvent.check_in_early_days)
                      : ""
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="check_in_late_hours">Check-in self-serve: ore max dopo l&apos;inizio</Label>
                <Input
                  id="check_in_late_hours"
                  name="check_in_late_hours"
                  type="number"
                  min={1}
                  max={336}
                  placeholder="Default 72 se vuoto"
                  defaultValue={
                    editingEvent?.check_in_late_hours != null
                      ? String(editingEvent.check_in_late_hours)
                      : ""
                  }
                />
              </div>
            </div>
            <p className="text-xs text-foreground/60">
              Vuoti = finestra globale (8 giorni prima, 72 ore dopo). Valori più stretti = QR utile solo più vicino
              all&apos;evento.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="category_id">Categoria</Label>
              <select
                id="category_id"
                name="category_id"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                defaultValue={editingEvent?.category_id ?? ""}
              >
                <option value="">Nessuna</option>
                {(categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <SubmitButton className="w-fit" pendingLabel="Salvataggio evento...">
              {editingEvent ? "Aggiorna evento" : "Crea evento"}
            </SubmitButton>
            {firstParam(params.success) ? <p className="text-sm text-emerald-700">{firstParam(params.success)}</p> : null}
            {firstParam(params.error) ? <p className="text-sm text-destructive">{firstParam(params.error)}</p> : null}
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>Eventi gestiti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(allEvents ?? []).length === 0 ? (
            <p className="text-sm text-foreground/70">Nessun evento creato.</p>
          ) : (
            (allEvents ?? []).map((event) => (
              <div key={event.id} className="rounded-2xl bg-secondary/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-foreground/65">{event.slug}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{event.status}</Badge>
                    <Link
                      href={`/admin/events?edit=${event.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Modifica
                    </Link>
                    <Link href={`/admin/events/${event.id}`} className="text-sm font-medium text-primary hover:underline">
                      Partecipanti
                    </Link>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-4 text-sm text-foreground/70">
                  <p>{event.starts_at}</p>
                  <p>{event.capacity} posti</p>
                </div>
                <form action={deleteEvent} className="mt-3">
                  <input type="hidden" name="id" value={event.id} />
                  <SubmitButton variant="outline" pendingLabel="Eliminazione...">
                    Elimina
                  </SubmitButton>
                </form>
              </div>
            ))
          )}

          {publishedEvents.length > 0 ? (
            <div className="rounded-2xl border border-border/70 p-4 text-sm text-foreground/70">
              Eventi pubblicati visibili al pubblico: {publishedEvents.length}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
