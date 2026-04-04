import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { getAdminNotesForStaff, getAllProfilesForStaff } from "@/lib/gamestore/data";
import { requireUserWithRole } from "@/lib/gamestore/authz";
import { addAdminNote } from "../actions";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminCrmPage({ searchParams }: PageProps) {
  const query = (await searchParams) ?? {};
  const { supabase } = await requireUserWithRole("staff");
  const [profiles, notes] = await Promise.all([
    getAllProfilesForStaff(supabase),
    getAdminNotesForStaff(supabase),
  ]);

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>Profili e note CRM</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addAdminNote} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="subject_profile_id">Profilo</Label>
              {profiles.length === 0 ? (
                <p className="text-sm text-foreground/70">Nessun profilo registrato.</p>
              ) : (
                <select
                  id="subject_profile_id"
                  name="subject_profile_id"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  required
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name || profile.email || profile.id}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="body">Nota interna</Label>
              <textarea id="body" name="body" rows={6} className="min-h-28 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" required />
            </div>
            <SubmitButton className="w-fit" pendingLabel="Salvataggio nota..." disabled={profiles.length === 0}>
              Salva nota
            </SubmitButton>
            {firstParam(query.success) ? <p className="text-sm text-emerald-700">{firstParam(query.success)}</p> : null}
            {firstParam(query.error) ? <p className="text-sm text-destructive">{firstParam(query.error)}</p> : null}
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>Clienti registrati</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {profiles.map((profile) => (
            <div key={profile.id} className="rounded-2xl bg-secondary/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{profile.full_name || profile.email || profile.id}</p>
                  <p className="text-sm text-foreground/65">{profile.email || "Email non disponibile"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-foreground/70">{profile.role}</p>
                  <Link
                    href={`/admin/crm/${profile.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Scheda completa
                  </Link>
                </div>
              </div>
              <p className="mt-2 text-sm text-foreground/70">
                Interests: {(profile.interests ?? []).join(", ") || "n/a"} · Newsletter: {profile.newsletter_opt_in ? "yes" : "no"} · Marketing: {profile.marketing_consent ? "yes" : "no"}
              </p>
            </div>
          ))}

          {notes.length > 0 ? (
            <div className="rounded-2xl border border-border/70 p-4">
              <p className="font-medium">Ultime note</p>
              <div className="mt-3 space-y-3 text-sm text-foreground/72">
                {notes.map((note) => {
                  const profile = note.subject_profile;
                  return (
                    <div key={note.id}>
                      <p className="font-medium">{profile?.full_name || profile?.email || note.subject_profile_id}</p>
                      <p>{note.body}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
