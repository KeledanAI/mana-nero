import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/breadcrumb";
import { notFound } from "next/navigation";

import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  formatCurrencyLabel,
  formatDateTime,
  formatRegistrationStatus,
  getEventBySlug,
  getUserRegistrations,
} from "@/lib/gamestore/data";
import {
  eventCheckoutAmountCents,
  eventRequiresOnlinePayment,
} from "@/lib/payments/event-checkout";
import { bookEvent, cancelEventBooking, startEventPaymentCheckout } from "../actions";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const checkoutErrorMessages: Record<string, string> = {
  missing_checkout_params: "Parametri di checkout non validi.",
  event_not_found: "Evento non trovato.",
  checkout_not_allowed: "Non è possibile avviare il pagamento per questa iscrizione.",
  event_not_paid: "Questo evento non richiede pagamento online.",
  amount_too_low: "Importo troppo basso per Stripe (minimo 0,50 €).",
  stripe_not_configured: "Pagamenti non configurati sul server.",
  checkout_session_failed: "Impossibile creare la sessione di pagamento.",
};

function checkoutErrorMessage(code: string | undefined) {
  if (!code) return null;
  try {
    const decoded = decodeURIComponent(code);
    return checkoutErrorMessages[decoded] ?? decoded;
  } catch {
    return checkoutErrorMessages[code] ?? code;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const event = await getEventBySlug(supabase, slug);
  if (!event) return { title: "Evento" };

  const description =
    event.description?.replace(/\s+/g, " ").trim().slice(0, 155) ||
    `${formatDateTime(event.starts_at)} — ${event.title}`;

  return { title: event.title, description };
}

export default async function EventDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = (await searchParams) ?? {};
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
  const paymentNotice = firstParam(query.payment);
  const checkoutError = checkoutErrorMessage(firstParam(query.error));
  const checkoutAmount = eventRequiresOnlinePayment(event)
    ? eventCheckoutAmountCents(event) / 100
    : null;

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

          {paymentNotice === "success" ? (
            <p className="text-sm text-emerald-700">
              Pagamento registrato. L&apos;iscrizione risulta confermata non appena il sistema elabora il webhook.
            </p>
          ) : null}
          {paymentNotice === "cancelled" ? (
            <p className="text-sm text-foreground/75">Pagamento annullato. Puoi riprovare quando vuoi.</p>
          ) : null}
          {checkoutError ? <p className="text-sm text-destructive">{checkoutError}</p> : null}

          {registration ? (
            <div className="space-y-4 rounded-xl border border-border/60 bg-secondary/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-foreground/70">Stato iscrizione:</span>
                <Badge variant="secondary">
                  {formatRegistrationStatus(registration.status, registration.waitlist_position)}
                </Badge>
              </div>
              {registration.status === "pending_payment" &&
              eventRequiresOnlinePayment(event) &&
              checkoutAmount != null ? (
                <div className="space-y-3">
                  <p className="text-sm text-foreground/75">
                    Importo da pagare:{" "}
                    <strong>{formatCurrencyLabel(checkoutAmount) ?? `${checkoutAmount} €`}</strong>
                  </p>
                  <form action={startEventPaymentCheckout} className="flex flex-wrap gap-3">
                    <input type="hidden" name="registration_id" value={registration.id} />
                    <input type="hidden" name="event_slug" value={event.slug} />
                    <SubmitButton pendingLabel="Reindirizzamento a Stripe…">
                      Completa pagamento
                    </SubmitButton>
                  </form>
                </div>
              ) : null}
              <form action={cancelEventBooking}>
                <input type="hidden" name="event_id" value={event.id} />
                <SubmitButton variant="outline" pendingLabel="Annullamento...">
                  Cancella prenotazione
                </SubmitButton>
              </form>
            </div>
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
