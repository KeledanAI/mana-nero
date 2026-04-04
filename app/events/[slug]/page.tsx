import Link from "next/link";
import { Breadcrumb } from "@/components/breadcrumb";
import { PublicShell } from "@/components/public-shell";
import { notFound } from "next/navigation";

import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { eventCardImageUrl } from "@/lib/design/media";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, getEventBySlug, getUserRegistrations } from "@/lib/gamestore/data";
import { MapPin } from "lucide-react";
import { bookEvent, cancelEventBooking } from "../actions";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EventDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [event, registrations] = await Promise.all([
    getEventBySlug(supabase, slug),
    user ? getUserRegistrations(supabase, user.id) : Promise.resolve([]),
  ]);

  if (!event) notFound();

  const registration = registrations.find((item) => item.event_id === event.id);

  return (
    <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Eventi", href: "/events" },
          { label: event.title },
        ]}
        className="mb-6"
      />
      <Card className="border-border/70 bg-card/85">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {event.event_categories?.name ? <Badge variant="secondary">{event.event_categories.name}</Badge> : null}
            {event.game_type ? <Badge variant="outline">{event.game_type}</Badge> : null}
            <Badge variant="outline">{event.capacity} posti</Badge>
          </div>
          <CardTitle className="text-4xl">{event.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-foreground/70">{formatDateTime(event.starts_at)}</p>
          {event.price_display ? <p className="text-sm text-foreground/70">{event.price_display}</p> : null}
          <p className="text-base leading-7 text-foreground/75">
            {event.description || "Descrizione evento non ancora disponibile."}
          </p>

          {registration ? (
            <form action={cancelEventBooking}>
              <input type="hidden" name="event_id" value={event.id} />
              <SubmitButton variant="outline" pendingLabel="Annullamento...">
                Cancella prenotazione
              </SubmitButton>
            </form>
          ) : user ? (
            <form action={bookEvent}>
              <input type="hidden" name="event_id" value={event.id} />
              <SubmitButton pendingLabel="Prenotazione...">Prenota posto</SubmitButton>
            </form>
          ) : (
            <Link href="/auth/login" className="text-sm font-medium text-primary hover:underline">
              Accedi per prenotare
            </Link>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
