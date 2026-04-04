import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, getEventRegistrationsForStaff } from "@/lib/gamestore/data";
import { requireUserWithRole } from "@/lib/gamestore/authz";
import { notFound } from "next/navigation";
import { checkInRegistration } from "../../actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminEventDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const { supabase } = await requireUserWithRole("staff");
  const [{ data: event }, registrations] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, slug, starts_at, capacity, status")
      .eq("id", id)
      .maybeSingle(),
    getEventRegistrationsForStaff(supabase, id),
  ]);

  if (!event) notFound();

  return (
    <section className="grid gap-6">
      <nav className="text-sm text-foreground/65">
        <Link href="/admin/events" className="font-medium text-primary hover:underline">
          ← Eventi
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground/80">{event.title}</span>
      </nav>

      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>{event.title}</CardTitle>
              <p className="mt-2 text-sm text-foreground/70">
                {formatDateTime(event.starts_at)} · {event.capacity} posti
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">{event.status}</Badge>
              <Link
                href={`/admin/events?edit=${event.id}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Modifica evento
              </Link>
              <Link href={`/admin/events/${event.id}/participants.csv`} className="text-sm font-medium text-primary hover:underline">
                Export CSV
              </Link>
            </div>
          </div>
          {firstParam(query.success) ? <p className="text-sm text-emerald-700">{firstParam(query.success)}</p> : null}
          {firstParam(query.error) ? <p className="text-sm text-destructive">{firstParam(query.error)}</p> : null}
        </CardHeader>
      </Card>

      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>Partecipanti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {registrations.length === 0 ? (
            <p className="text-sm text-foreground/70">Nessuna registrazione per questo evento.</p>
          ) : (
            registrations.map((registration) => {
              const profile = registration.profiles;

              return (
                <div key={registration.id} className="rounded-2xl bg-secondary/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {profile?.full_name || profile?.email || registration.user_id}
                      </p>
                      <p className="text-sm text-foreground/65">
                        {profile?.email || "Email non disponibile"}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {registration.status}
                      {registration.status === "waitlisted" &&
                      registration.waitlist_position
                        ? ` #${registration.waitlist_position}`
                        : ""}
                    </Badge>
                  </div>
                  {registration.status === "confirmed" ? (
                    <form action={checkInRegistration} className="mt-3">
                      <input type="hidden" name="registration_id" value={registration.id} />
                      <input type="hidden" name="event_id" value={id} />
                      <SubmitButton pendingLabel="Check-in...">Check-in</SubmitButton>
                    </form>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </section>
  );
}
