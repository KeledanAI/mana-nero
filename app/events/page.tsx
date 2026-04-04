import Link from "next/link";
import { Suspense } from "react";

import { EventCard } from "@/components/event-card";
import { PublicShell } from "@/components/public-shell";
import { SearchParamsToast } from "@/components/search-params-toast";
import { SectionHeading } from "@/components/section-heading";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { eventCardImageUrl } from "@/lib/design/media";
import { formatDateTime, formatRegistrationStatus, getPublishedEvents, getUserRegistrations } from "@/lib/gamestore/data";
import { createClient } from "@/lib/supabase/server";
import { bookEvent, cancelEventBooking } from "./actions";

export default async function EventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [events, registrations] = await Promise.all([
    getPublishedEvents(supabase),
    user ? getUserRegistrations(supabase, user.id) : Promise.resolve([]),
  ]);

  const registrationByEventId = new Map(
    registrations.map((registration) => [registration.event_id, registration]),
  );

  return (
    <PublicShell>
      <Suspense><SearchParamsToast /></Suspense>
      <main className="page-frame py-12">
        <SectionHeading
          eyebrow="Eventi"
          title="Scopri le prossime serate al Mana Nero."
          description="Tornei, serate demo, gioco libero e molto altro. Trova il tuo evento e prenota il posto."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {events.length === 0 ? (
            <Card className="glass-panel lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-white">Nessun evento pubblicato</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-7 text-white/62">
                Al momento non ci sono eventi in programma. Torna presto o seguici sui social!
              </CardContent>
            </Card>
          ) : null}

          {events.map((event, index) => {
            const registration = registrationByEventId.get(event.id);

            return (
              <div key={event.id} className="space-y-4">
                <EventCard
                  imageUrl={eventCardImageUrl(event.cover_image_path, event.slug, index)}
                  title={event.title}
                  description={event.description || "Dettagli evento non ancora inseriti."}
                  date={formatDateTime(event.starts_at)}
                  availability={`${event.capacity} posti`}
                  href={`/events/${event.slug}`}
                  category={event.event_categories?.name || event.game_type}
                />

                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {event.game_type ? (
                        <Badge variant="outline" className="border-white/15 bg-white/5 text-white/75">
                          {event.game_type}
                        </Badge>
                      ) : null}
                      {event.price_display ? (
                        <Badge variant="outline" className="border-white/15 bg-white/5 text-white/75">
                          {event.price_display}
                        </Badge>
                      ) : null}
                    </div>

                    {registration ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge className="border-0 bg-cyan-400/18 text-cyan-100 hover:bg-cyan-400/18">
                          {formatRegistrationStatus(registration.status, registration.waitlist_position)}
                        </Badge>
                        <form action={cancelEventBooking}>
                          <input type="hidden" name="event_id" value={event.id} />
                          <SubmitButton
                            variant="outline"
                            pendingLabel="Annullamento..."
                            className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                          >
                            Cancella
                          </SubmitButton>
                        </form>
                      </div>
                    ) : user ? (
                      <form action={bookEvent}>
                        <input type="hidden" name="event_id" value={event.id} />
                        <SubmitButton pendingLabel="Prenotazione...">Prenota posto</SubmitButton>
                      </form>
                    ) : (
                      <Link href="/auth/login" className="text-sm font-medium text-amber-300 hover:text-amber-200">
                        Accedi per prenotare
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </PublicShell>
  );
}
