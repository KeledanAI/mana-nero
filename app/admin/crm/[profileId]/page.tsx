import Link from "next/link";
import { notFound } from "next/navigation";

import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userMeetsRole } from "@/lib/auth/roles";
import {
  formatDateTime,
  getAdminNotesForSubject,
  getProfileByIdForStaff,
  getRegistrationsForProfileStaff,
} from "@/lib/gamestore/data";
import { requireUserWithRole } from "@/lib/gamestore/authz";
import { addAdminNote, updateCustomerProfile } from "../../actions";

type PageProps = {
  params: Promise<{ profileId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminCrmProfilePage({ params, searchParams }: PageProps) {
  const { profileId } = await params;
  const query = (await searchParams) ?? {};
  const { supabase, profile: actor } = await requireUserWithRole("staff");

  const subject = await getProfileByIdForStaff(supabase, profileId);
  if (!subject) notFound();

  const [notes, registrations] = await Promise.all([
    getAdminNotesForSubject(supabase, profileId),
    getRegistrationsForProfileStaff(supabase, profileId),
  ]);

  const canEditRole = userMeetsRole(actor?.role, "admin");

  return (
    <section className="grid gap-6">
      <nav className="text-sm text-foreground/65">
        <Link href="/admin/crm" className="font-medium text-primary hover:underline">
          ← CRM
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground/80">{subject.full_name || subject.email || subject.id}</span>
      </nav>

      {firstParam(query.success) ? (
        <p className="text-sm text-emerald-700">{firstParam(query.success)}</p>
      ) : null}
      {firstParam(query.error) ? (
        <p className="text-sm text-destructive">{firstParam(query.error)}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle>Scheda cliente</CardTitle>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="outline">{subject.role}</Badge>
              {subject.newsletter_opt_in ? <Badge variant="secondary">Newsletter</Badge> : null}
              {subject.marketing_consent ? <Badge variant="secondary">Marketing</Badge> : null}
            </div>
          </CardHeader>
          <CardContent>
            <form action={updateCustomerProfile} className="grid gap-4">
              <input type="hidden" name="id" value={subject.id} />
              <div className="grid gap-2">
                <Label htmlFor="email">Email (auth)</Label>
                <Input id="email" value={subject.email ?? ""} readOnly className="bg-secondary/50" />
                <p className="text-xs text-foreground/55">Sincronizzata da Supabase Auth; non modificabile qui.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="full_name">Nome visualizzato</Label>
                <Input id="full_name" name="full_name" defaultValue={subject.full_name ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="interests">Interessi (virgola)</Label>
                <Input
                  id="interests"
                  name="interests"
                  defaultValue={(subject.interests ?? []).join(", ")}
                  placeholder="Magic, One Piece, RPG"
                />
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="newsletter_opt_in" value="true" defaultChecked={subject.newsletter_opt_in} />
                  Newsletter opt-in
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="marketing_consent" value="true" defaultChecked={subject.marketing_consent} />
                  Consenso marketing
                </label>
              </div>
              {canEditRole ? (
                <div className="grid gap-2">
                  <Label htmlFor="role">Ruolo app</Label>
                  <select
                    id="role"
                    name="role"
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    defaultValue={subject.role}
                  >
                    <option value="customer">customer</option>
                    <option value="staff">staff</option>
                    <option value="admin">admin</option>
                  </select>
                  <p className="text-xs text-foreground/55">Solo admin può modificare il ruolo.</p>
                </div>
              ) : null}
              <SubmitButton className="w-fit" pendingLabel="Salvataggio...">
                Salva profilo
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border-border/70 bg-card/85">
            <CardHeader>
              <CardTitle>Nuova nota interna</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addAdminNote} className="grid gap-4">
                <input type="hidden" name="subject_profile_id" value={subject.id} />
                <div className="grid gap-2">
                  <Label htmlFor="note_body">Testo</Label>
                  <textarea
                    id="note_body"
                    name="body"
                    rows={5}
                    className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    required
                  />
                </div>
                <SubmitButton className="w-fit" pendingLabel="Salvataggio nota...">
                  Aggiungi nota
                </SubmitButton>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/85">
            <CardHeader>
              <CardTitle>Prenotazioni eventi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {registrations.length === 0 ? (
                <p className="text-foreground/70">Nessuna prenotazione attiva o passata indicizzata.</p>
              ) : (
                registrations.map((reg) => (
                  <div key={reg.id} className="rounded-xl bg-secondary/60 p-3">
                    <p className="font-medium">{reg.events?.title ?? "Evento"}</p>
                    <p className="text-foreground/65">
                      {reg.events?.starts_at ? formatDateTime(reg.events.starts_at) : ""} · {reg.status}
                      {reg.waitlist_position != null ? ` · waitlist #${reg.waitlist_position}` : ""}
                    </p>
                    {reg.events?.slug ? (
                      <Link href={`/events/${reg.events.slug}`} className="text-xs text-primary hover:underline">
                        Vedi evento pubblico
                      </Link>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {notes.length > 0 ? (
        <Card className="border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle>Note su questo cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {notes.map((note) => (
              <div key={note.id} className="rounded-xl border border-border/60 p-4 text-sm">
                <p className="text-xs text-foreground/55">{formatDateTime(note.created_at)}</p>
                <p className="mt-2 whitespace-pre-wrap">{note.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
