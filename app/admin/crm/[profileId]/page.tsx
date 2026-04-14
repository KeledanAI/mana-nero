import Link from "next/link";
import { notFound } from "next/navigation";

import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userMeetsRole } from "@/lib/auth/roles";
import {
  formatAuditTimelineDetail,
  formatAuditTimelineTitle,
  formatOutboxTimelineDetail,
  formatOutboxTimelineTitle,
} from "@/lib/gamestore/crm-timeline";
import {
  formatDateTime,
  getAdminNotesForSubject,
  getCrmAuditTrailForProfileStaff,
  getOutboxEmailTimelineForProfileStaff,
  getProductRequestsForProfileStaff,
  getProfileByIdForStaff,
  getRegistrationsForProfileStaff,
} from "@/lib/gamestore/data";
import { requireUserWithRole } from "@/lib/gamestore/authz";
import {
  addAdminNote,
  revokeMarketingConsentForSubject,
  revokeNewsletterOptInForSubject,
  updateCustomerProfile,
} from "../../actions";

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

  const [notes, registrations, productRequests, outboxRows, auditRows] = await Promise.all([
    getAdminNotesForSubject(supabase, profileId),
    getRegistrationsForProfileStaff(supabase, profileId),
    getProductRequestsForProfileStaff(supabase, profileId),
    getOutboxEmailTimelineForProfileStaff(supabase, profileId),
    getCrmAuditTrailForProfileStaff(supabase, profileId),
  ]);

  type TimelineItem = {
    key: string;
    at: string;
    kind: string;
    title: string;
    detail: string;
  };

  const timeline: TimelineItem[] = [];

  for (const n of notes) {
    timeline.push({
      key: `note-${n.id}`,
      at: n.created_at,
      kind: "note",
      title: "Nota interna",
      detail: n.body.length > 220 ? `${n.body.slice(0, 220)}…` : n.body,
    });
  }
  for (const r of registrations) {
    const ev = r.events;
    timeline.push({
      key: `registration-${r.id}`,
      at: r.created_at,
      kind: "registration",
      title: `Iscrizione evento · ${ev?.title ?? "Evento"}`,
      detail: `${r.status}${r.waitlist_position != null ? ` · waitlist #${r.waitlist_position}` : ""}${ev?.starts_at ? ` · ${formatDateTime(ev.starts_at)}` : ""}`,
    });
  }
  for (const p of productRequests) {
    timeline.push({
      key: `product-${p.id}`,
      at: p.created_at,
      kind: "product",
      title: `Richiesta prodotto · ${p.product_name}`,
      detail: `${p.status}${p.expected_fulfillment_at ? ` · previsto ${formatDateTime(p.expected_fulfillment_at)}` : ""}`,
    });
  }
  for (const o of outboxRows) {
    timeline.push({
      key: `outbox-${o.id}`,
      at: o.created_at,
      kind: "outbox",
      title: formatOutboxTimelineTitle(o),
      detail: formatOutboxTimelineDetail(o),
    });
  }
  for (const a of auditRows) {
    timeline.push({
      key: `audit-${a.id}`,
      at: a.created_at,
      kind: "audit",
      title: formatAuditTimelineTitle(a),
      detail: formatAuditTimelineDetail(a),
    });
  }

  timeline.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());

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
        <p className="text-sm text-emerald-700">
          {firstParam(query.success) === "marketing_revoked"
            ? "Marketing consent revocato."
            : firstParam(query.success) === "newsletter_revoked"
              ? "Newsletter opt-in revocato; eventuali campagne segmentate in coda sono state annullate se possibile."
              : firstParam(query.success)}
        </p>
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
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefono (CRM)</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  defaultValue={subject.phone ?? ""}
                  placeholder="+39 …"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="crm_tags">Tag CRM (virgola)</Label>
                <Input
                  id="crm_tags"
                  name="crm_tags"
                  defaultValue={(subject.crm_tags ?? []).join(", ")}
                  placeholder="vip, torneo, preordine"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lead_stage">Fase lead</Label>
                <Input
                  id="lead_stage"
                  name="lead_stage"
                  defaultValue={subject.lead_stage ?? ""}
                  placeholder="cold / warm / visit"
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
              <div className="grid gap-2">
                <Label htmlFor="stock_notification_lookahead_days">
                  Lookahead stock (giorni, opzionale)
                </Label>
                <Input
                  id="stock_notification_lookahead_days"
                  name="stock_notification_lookahead_days"
                  type="number"
                  min={1}
                  max={730}
                  placeholder="Vuoto = solo env globale"
                  defaultValue={
                    subject.stock_notification_lookahead_days != null
                      ? String(subject.stock_notification_lookahead_days)
                      : ""
                  }
                />
                <p className="text-xs text-foreground/55">
                  Override per notifiche arrivo merce (cron stock). Vuoto = usa solo{" "}
                  <code className="text-xs">PRODUCT_STOCK_EXPECTED_LOOKAHEAD_DAYS</code>.
                </p>
              </div>
              <SubmitButton className="w-fit" pendingLabel="Salvataggio...">
                Salva profilo
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border-border/70 bg-card/85">
            <CardHeader>
              <CardTitle>Consensi rapidi</CardTitle>
              <p className="text-sm font-normal text-foreground/65">
                Revoche dedicate: aggiornano il profilo e annullano in outbox le righe{" "}
                <code className="text-xs">campaign_segment</code> in attesa per quel segmento (migrazioni Q2).
              </p>
            </CardHeader>
            <CardContent className="grid gap-4">
              {subject.newsletter_opt_in ? (
                <form action={revokeNewsletterOptInForSubject} className="grid gap-2">
                  <input type="hidden" name="subject_profile_id" value={subject.id} />
                  <SubmitButton variant="outline" className="w-fit" pendingLabel="Revoca in corso…">
                    Revoca newsletter opt-in
                  </SubmitButton>
                </form>
              ) : null}
              {subject.marketing_consent ? (
                <form action={revokeMarketingConsentForSubject} className="grid gap-2">
                  <input type="hidden" name="subject_profile_id" value={subject.id} />
                  <SubmitButton variant="outline" className="w-fit" pendingLabel="Revoca in corso…">
                    Revoca marketing consent
                  </SubmitButton>
                </form>
              ) : null}
              {!subject.newsletter_opt_in && !subject.marketing_consent ? (
                <p className="text-sm text-foreground/65">Nessun consenso newsletter o marketing attivo.</p>
              ) : null}
            </CardContent>
          </Card>
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

      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>Timeline (Fase 2)</CardTitle>
          <p className="text-sm font-normal text-foreground/65">
            Vista unificata cronologica: note, iscrizioni, richieste prodotto, email in outbox (canale email con{" "}
            <code className="text-xs">user_id</code> nel payload) con tipo messaggio, oggetto campagna, stato e dettagli
            errore/skip; audit staff collegati al profilo o alle iscrizioni con etichette leggibili.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {timeline.length === 0 ? (
            <p className="text-foreground/70">Nessun elemento nella timeline.</p>
          ) : (
            timeline.map((item) => (
              <div
                key={item.key}
                className="rounded-xl border border-border/50 bg-secondary/40 px-4 py-3"
              >
                <p className="text-xs text-foreground/55">{formatDateTime(item.at)}</p>
                <p className="mt-1 font-medium text-foreground/90">{item.title}</p>
                <p className="mt-1 text-foreground/75">{item.detail}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
