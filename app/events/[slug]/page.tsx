import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/breadcrumb";
import { notFound } from "next/navigation";

import { PublicShell } from "@/components/public-shell";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { eventCardImageUrl } from "@/lib/design/media";
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
  const heroUrl = eventCardImageUrl(event.cover_image_path, event.slug, 0);

  return (
    <PublicShell>
      <main>
        <div
          className="relative w-full overflow-hidden border-b border-white/10"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(8,10,21,0.45) 0%, rgba(8,10,21,0.92) 100%), url(${heroUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="page-frame py-16 sm:py-20 lg:py-24">
            <Breadcrumb
              items={[
                { label: "Home", href: "/" },
                { label: "Eventi", href: "/events" },
                { label: event.title },
              ]}
              className="mb-6"
            />
            <div className="flex flex-wrap items-center gap-2">
              {event.event_categories?.name ? (
                <Badge className="border-0 bg-amber-400/20 text-amber-200 hover:bg-amber-400/20">
                  {event.event_categories.name}
                </Badge>
              ) : null}
              {event.game_type ? (
                <Badge variant="outline" className="border-white/15 bg-white/5 text-white/80">
                  {event.game_type}
                </Badge>
              ) : null}
              <Badge variant="outline" className="border-white/15 bg-white/5 text-white/80">
                {event.capacity} posti
              </Badge>
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              {event.title}
            </h1>
            <p className="mt-5 text-sm uppercase tracking-[0.2em] text-white/60">
              {formatDateTime(event.starts_at)}
            </p>
            {event.price_display ? (
              <p className="mt-2 text-sm text-white/60">{event.price_display}</p>
            ) : null}
          </div>
        </div>

        <div className="page-frame grid gap-8 py-12 lg:grid-cols-[1.4fr_0.9fr]">
          <article className="space-y-6">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-white">Dettagli evento</h2>
              <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-white/72">
                {event.description || "Descrizione evento non ancora disponibile."}
              </p>
            </div>

            {paymentNotice === "success" ? (
              <p className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-200">
                Pagamento registrato. L&apos;iscrizione risulta confermata non appena il sistema elabora il webhook.
              </p>
            ) : null}
            {paymentNotice === "cancelled" ? (
              <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/72">
                Pagamento annullato. Puoi riprovare quando vuoi.
              </p>
            ) : null}
            {checkoutError ? (
              <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                {checkoutError}
              </p>
            ) : null}
          </article>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="glass-panel rounded-[1.75rem] p-6">
              <p className="text-[11px] uppercase tracking-[0.32em] text-amber-300/70">
                La tua prenotazione
              </p>
              <h2 className="mt-3 text-xl font-semibold text-white">
                {registration ? "Prenotazione attiva" : "Prenota il tuo posto"}
              </h2>

              {registration ? (
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-white/70">Stato:</span>
                    <Badge className="border-0 bg-cyan-400/18 text-cyan-100 hover:bg-cyan-400/18">
                      {formatRegistrationStatus(registration.status, registration.waitlist_position)}
                    </Badge>
                  </div>
                  {registration.status === "pending_payment" &&
                  eventRequiresOnlinePayment(event) &&
                  checkoutAmount != null ? (
                    <div className="space-y-3 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4">
                      <p className="text-sm text-white/80">
                        Importo da pagare:{" "}
                        <strong className="text-white">
                          {formatCurrencyLabel(checkoutAmount) ?? `${checkoutAmount} €`}
                        </strong>
                      </p>
                      <form action={startEventPaymentCheckout}>
                        <input type="hidden" name="registration_id" value={registration.id} />
                        <input type="hidden" name="event_slug" value={event.slug} />
                        <SubmitButton pendingLabel="Reindirizzamento a Stripe…" className="w-full">
                          Completa pagamento
                        </SubmitButton>
                      </form>
                    </div>
                  ) : null}
                  <form action={cancelEventBooking}>
                    <input type="hidden" name="event_id" value={event.id} />
                    <SubmitButton
                      variant="outline"
                      pendingLabel="Annullamento..."
                      className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                    >
                      Cancella prenotazione
                    </SubmitButton>
                  </form>
                </div>
              ) : user ? (
                <form action={bookEvent} className="mt-5 space-y-3">
                  <input type="hidden" name="event_id" value={event.id} />
                  <SubmitButton pendingLabel="Prenotazione..." className="w-full">
                    Prenota posto
                  </SubmitButton>
                  <p className="text-xs leading-5 text-white/55">
                    Se i posti sono esauriti, verrai aggiunto in lista d&apos;attesa.
                  </p>
                </form>
              ) : (
                <div className="mt-5 space-y-3">
                  <Link
                    href={`/auth/login?next=/events/${event.slug}`}
                    className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/90"
                  >
                    Accedi per prenotare
                  </Link>
                  <p className="text-xs leading-5 text-white/55">
                    La registrazione richiede meno di 30 secondi.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </PublicShell>
  );
}
