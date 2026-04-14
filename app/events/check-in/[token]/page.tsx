import Link from "next/link";

import { createPublicAnonClient } from "@/lib/supabase/public-anon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PageProps = {
  params: Promise<{ token: string }>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function googleCalendarTemplateUrl(startIso: string, title: string): string | null {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 2 * 3600000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const text = encodeURIComponent(title.trim() || "Evento");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(start)}/${fmt(end)}`;
}

function messageForError(code: string | undefined): string {
  switch (code) {
    case "invalid_token":
      return "Link non valido.";
    case "token_not_found":
      return "Questo link non è più valido o non esiste.";
    case "not_checkin_ready":
      return "Check-in non disponibile per questa iscrizione (stato non confermato).";
    case "event_not_found":
      return "Evento non trovato.";
    case "event_not_published":
      return "L’evento non è più pubblicato.";
    case "too_early":
      return "Check-in non ancora disponibile per questo evento.";
    case "too_late":
      return "Il periodo di check-in automatico per questo evento è scaduto. Chiedi allo staff in negozio.";
    case "concurrent_change":
      return "Operazione non riuscita. Riprova o chiedi allo staff.";
    default:
      return "Check-in non riuscito. Chiedi allo staff in negozio.";
  }
}

export default async function EventCheckInByTokenPage({ params }: PageProps) {
  const { token } = await params;
  const trimmed = token?.trim() ?? "";

  if (!UUID_RE.test(trimmed)) {
    return (
      <section
        className="mx-auto grid max-w-lg gap-4 px-4 py-16"
        data-testid="check-in-invalid-token"
      >
        <Card className="border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle>Link non valido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-foreground/75">
            <p>Il codice nel link non è nel formato atteso.</p>
            <Link href="/events" className="font-medium text-primary hover:underline">
              Torna agli eventi
            </Link>
          </CardContent>
        </Card>
      </section>
    );
  }

  let payload: Record<string, unknown> | null = null;
  let rpcError: string | null = null;

  try {
    const supabase = createPublicAnonClient();
    const { data, error } = await supabase.rpc("event_check_in_by_token", {
      p_token: trimmed,
    });
    if (error) {
      rpcError = error.message;
    } else if (data && typeof data === "object") {
      payload = data as Record<string, unknown>;
    }
  } catch (e) {
    rpcError = e instanceof Error ? e.message : "check_in_unavailable";
  }

  if (rpcError) {
    return (
      <section className="mx-auto grid max-w-lg gap-4 px-4 py-16" data-testid="check-in-rpc-unavailable">
        <Card className="border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle>Check-in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-foreground/75">
            <p className="text-destructive">Servizio temporaneamente non disponibile: {rpcError}</p>
            <p className="text-xs text-foreground/60">
              Se vedi un errore sul nome della funzione RPC, applica le migrazioni Supabase più recenti (
              <code className="rounded bg-secondary px-1">supabase db push</code>).
            </p>
            <Link href="/events" className="font-medium text-primary hover:underline">
              Torna agli eventi
            </Link>
          </CardContent>
        </Card>
      </section>
    );
  }

  const ok = payload?.ok === true;
  const errCode = typeof payload?.error === "string" ? payload.error : undefined;

  if (ok) {
    const result = payload ?? {};
    const slug =
      typeof result.event_slug === "string" && result.event_slug.trim().length > 0
        ? result.event_slug.trim()
        : "";
    const eventHref = slug ? `/events/${encodeURIComponent(slug)}` : "/events";
    const startIso = typeof result.event_starts_at === "string" ? result.event_starts_at : "";
    const eventTitle = typeof result.event_title === "string" ? result.event_title : "";
    const calHref = startIso ? googleCalendarTemplateUrl(startIso, eventTitle) : null;

    return (
      <section
        className="mx-auto grid max-w-lg gap-4 px-4 py-16"
        data-testid="check-in-success"
      >
        <Card className="border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle>Check-in completato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-foreground/80">
            <p className="text-emerald-700">La tua presenza è stata registrata. Buon divertimento!</p>
            <p className="text-xs text-foreground/60">
              Puoi tenere questa schermata come conferma oppure aprire la pagina dell&apos;evento qui sotto.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href={eventHref} className="font-medium text-primary hover:underline">
                {slug ? "Vai alla pagina dell’evento" : "Torna agli eventi"}
              </Link>
              <Link href="/events" className="font-medium text-foreground/70 hover:underline">
                Tutti gli eventi
              </Link>
              {calHref ? (
                <a
                  href={calHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Aggiungi a Google Calendar
                </a>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto grid max-w-lg gap-4 px-4 py-16" data-testid="check-in-error">
      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>Check-in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-foreground/75">
          <p>{messageForError(errCode)}</p>
          <Link href="/events" className="font-medium text-primary hover:underline">
            Torna agli eventi
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}
