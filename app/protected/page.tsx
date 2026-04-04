import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { getProfileForUser } from "@/lib/auth/roles";
import {
  formatCurrencyLabel,
  formatDateTime,
  formatProductRequestStatus,
  formatRegistrationStatus,
  getUserProductRequests,
  getUserRegistrations,
} from "@/lib/gamestore/data";
import { createClient } from "@/lib/supabase/server";
import { CalendarDays, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { saveProfile } from "./actions";

const dashboardCards = [
  {
    title: "Prenotazioni",
    text: "Le tue iscrizioni agli eventi con stato confermato o lista d'attesa.",
    icon: CalendarDays,
  },
  {
    title: "Preferenze",
    text: "I tuoi giochi preferiti e le categorie che segui per ricevere aggiornamenti mirati.",
    icon: Sparkles,
  },
  {
    title: "Comunicazioni",
    text: "Gestisci newsletter e preferenze di contatto per restare aggiornato sulle serate.",
    icon: Mail,
  },
];

type ProtectedPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProtectedPage({ searchParams }: ProtectedPageProps) {
  const query = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const [profile, registrations, productRequests] = await Promise.all([
    getProfileForUser(supabase, user.id),
    getUserRegistrations(supabase, user.id),
    getUserProductRequests(supabase, user.id),
  ]);

  return (
    <section className="grid gap-6">
      <Card className="border-border/70 bg-card/85">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-accent text-accent-foreground hover:bg-accent">
              Accesso confermato
            </Badge>
            <Badge variant="outline">{profile?.role ?? "customer"}</Badge>
          </div>
          <div>
            <CardTitle className="text-3xl">
              {profile?.full_name || user.email || "Profilo giocatore"}
            </CardTitle>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/68">
              Gestisci il tuo profilo, le prenotazioni agli eventi e le richieste
              prodotto dal tuo account Mana Nero.
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-secondary/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">
              Email
            </p>
            <p className="mt-2 font-medium">{profile?.email || user.email}</p>
          </div>
          <div className="rounded-2xl bg-secondary/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">
              Newsletter
            </p>
            <p className="mt-2 font-medium">
              {profile?.newsletter_opt_in ? "Attiva" : "Non attiva"}
            </p>
          </div>
          <div className="rounded-2xl bg-secondary/70 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">
              Marketing consent
            </p>
            <p className="mt-2 font-medium">
              {profile?.marketing_consent ? "Confermato" : "Da raccogliere"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {dashboardCards.map(({ title, text, icon: Icon }) => (
          <Card key={title} className="border-border/70 bg-card/85">
            <CardHeader>
              <Icon className="h-5 w-5 text-primary" />
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-foreground/70">{text}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle>Interessi profilo</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(profile?.interests?.length
              ? profile.interests
              : ["Magic", "One Piece", "Board Games"]).map((interest) => (
              <Badge key={interest} variant="secondary">
                {interest}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle>Modifica profilo</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveProfile} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="full_name">Nome completo</Label>
                <Input id="full_name" name="full_name" defaultValue={profile?.full_name || ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="interests">Interessi</Label>
                <Input
                  id="interests"
                  name="interests"
                  defaultValue={(profile?.interests ?? []).join(", ")}
                  placeholder="Magic, Pokemon, Board Games"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="telegram_username">Telegram</Label>
                  <Input id="telegram_username" name="telegram_username" defaultValue={profile?.telegram_username || ""} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="whatsapp_e164">WhatsApp</Label>
                  <Input id="whatsapp_e164" name="whatsapp_e164" defaultValue={profile?.whatsapp_e164 || ""} />
                </div>
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="newsletter_opt_in" defaultChecked={profile?.newsletter_opt_in ?? false} />
                Newsletter attiva
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="marketing_consent" defaultChecked={profile?.marketing_consent ?? false} />
                Consenso marketing
              </label>
              <SubmitButton className="w-fit" pendingLabel="Salvataggio profilo...">
                Salva profilo
              </SubmitButton>
              {firstParam(query.success) ? <p className="text-sm text-emerald-700">{firstParam(query.success)}</p> : null}
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle>Le tue prenotazioni</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {registrations.length === 0 ? (
              <p className="text-sm leading-6 text-foreground/70">
                Nessuna prenotazione attiva. Vai nella sezione Eventi per
                prenotare il tuo posto.
              </p>
            ) : (
              registrations.map((registration) => (
                <div
                  key={registration.id}
                  className="rounded-2xl bg-secondary/70 p-4 text-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium">
                      {registration.events?.title || "Evento"}
                    </p>
                    <Badge variant="outline">
                      {formatRegistrationStatus(registration.status, registration.waitlist_position)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-foreground/68">
                    {registration.events?.starts_at
                      ? formatDateTime(registration.events.starts_at)
                      : "Data non disponibile"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle>Richieste prodotto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {productRequests.length === 0 ? (
              <p className="text-sm leading-6 text-foreground/70">
                Nessuna richiesta prodotto inviata. Vai nella sezione
                Richieste per cercare un prodotto.
              </p>
            ) : (
              productRequests.map((request) => (
                <div key={request.id} className="rounded-2xl bg-secondary/70 p-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium">{request.product_name}</p>
                    <Badge variant="outline">{formatProductRequestStatus(request.status)}</Badge>
                  </div>
                  <p className="mt-2 text-foreground/68">
                    {request.category || "Categoria libera"}{request.quantity ? ` · Qtà ${request.quantity}` : ""}
                    {request.desired_price != null
                      ? ` · ${formatCurrencyLabel(request.desired_price)}`
                      : ""}
                  </p>
                  {request.notes ? (
                    <p className="mt-2 text-foreground/68">{request.notes}</p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
