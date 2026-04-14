import Link from "next/link";

import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserWithRole } from "@/lib/gamestore/authz";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  runEventReminderScan,
  runNewsletterCampaignEnqueue,
  saveCommsCampaignRecord,
} from "../actions";
import { formatOutboxTimelineDetail, formatOutboxTimelineTitle, outboxPayloadKindLabel } from "@/lib/gamestore/crm-timeline";
import { formatDateTime, getCommsCampaignsForStaff, getOutboxRowsForCampaignSlugStaff } from "@/lib/gamestore/data";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type OutboxEmailStatRow = {
  kind: string;
  status: string;
  n: number | string;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminCommsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const { supabase } = await requireUserWithRole("staff");

  const [campaigns, statsRpc] = await Promise.all([
    getCommsCampaignsForStaff(supabase),
    supabase.rpc("outbox_email_stats_for_staff"),
  ]);
  const statsRaw = statsRpc.data;
  const statsError = statsRpc.error;
  const statsRows: OutboxEmailStatRow[] = Array.isArray(statsRaw)
    ? (statsRaw as OutboxEmailStatRow[])
    : [];

  const campaignSlug = firstParam(params.campaign_slug)?.trim() ?? "";
  const campaignHistory =
    campaignSlug.length > 0 ? await getOutboxRowsForCampaignSlugStaff(supabase, campaignSlug) : [];

  const events = firstParam(params.events);
  const attempted = firstParam(params.attempted);
  const campaignAttempted = firstParam(params.campaign_attempted);
  const campaignErrors = firstParam(params.campaign_errors);

  return (
    <section className="grid gap-6">
      <nav className="text-sm text-foreground/65">
        <Link href="/admin" className="font-medium text-primary hover:underline">
          ← Dashboard
        </Link>
      </nav>

      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>Comunicazioni automatizzate</CardTitle>
          <p className="text-sm font-normal text-foreground/65">
            I messaggi transazionali passano dall&apos;outbox (
            <code className="text-xs">communication_outbox</code>). Qui puoi accodare i reminder
            ~24h prima degli eventi senza inviare email dal browser.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
            <p className="text-sm font-medium text-foreground/90">Metriche outbox email (staff)</p>
            <p className="mt-1 text-xs text-foreground/60">
              Conteggi per <code className="rounded bg-background/80 px-1">{`payload->>'kind'`}</code> e{" "}
              <code className="rounded bg-background/80 px-1">status</code> sulla tabella{" "}
              <code className="rounded bg-background/80 px-1">communication_outbox</code> (solo canale{" "}
              <code className="rounded bg-background/80 px-1">email</code>).
            </p>
            {statsError ? (
              <p className="mt-2 text-sm text-destructive">
                Impossibile caricare le metriche: {statsError.message}. Se il DB non ha ancora la migrazione
                <code className="mx-1 rounded bg-background/80 px-1 text-xs">
                  20260416180000_outbox_email_stats_for_staff
                </code>
                , esegui <code className="rounded bg-background/80 px-1 text-xs">supabase db push</code>.
              </p>
            ) : statsRows.length === 0 ? (
              <p className="mt-2 text-sm text-foreground/70">Nessuna riga outbox email ancora registrata.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[280px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-foreground/65">
                      <th className="py-2 pr-3 font-medium">Tipo messaggio</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 font-medium">N</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsRows.map((row) => (
                      <tr key={`${row.kind}:${row.status}`} className="border-b border-border/40">
                        <td className="py-2 pr-3">
                          <span className="text-foreground/85">{outboxPayloadKindLabel(row.kind)}</span>
                          <span className="mt-0.5 block font-mono text-[10px] text-foreground/45">{row.kind}</span>
                        </td>
                        <td className="py-2 pr-3">{row.status}</td>
                        <td className="py-2 tabular-nums">{Number(row.n)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-sm text-foreground/75">
            In produzione lo stesso scan è eseguito dal cron Vercel su{" "}
            <code className="rounded bg-secondary px-1 text-xs">/api/cron/event-reminders</code>{" "}
            (stessi secret del worker outbox). Documentazione di progetto: file{" "}
            <code className="rounded bg-secondary px-1 text-xs">docs/design-v2-comms-automation.md</code>.
          </p>

          {events != null && attempted != null ? (
            <p className="text-sm text-emerald-700">
              Ultimo scan: {events} evento/i in finestra, {attempted} righe outbox tentate (duplicati
              ignorati da idempotency).
            </p>
          ) : null}
          {firstParam(params.error) ? (
            <p className="text-sm text-destructive">{firstParam(params.error)}</p>
          ) : null}
          {firstParam(params.success) === "record_saved" ? (
            <p className="text-sm text-emerald-700">Record campagna salvato in tabella comms_campaigns.</p>
          ) : null}

          <form action={runEventReminderScan}>
            <SubmitButton pendingLabel="Scansione in corso…">Esegui scan reminder 24h ora</SubmitButton>
          </form>

          <div className="border-t border-border/60 pt-6">
            <p className="text-sm font-medium text-foreground/90">Campagna segmentata (primo slice)</p>
            <p className="mt-1 text-xs text-foreground/60">
              Accoda in outbox messaggi <code className="rounded bg-secondary px-1 text-xs">campaign_segment</code>{" "}
              per segmento scelto (newsletter opt-in o marketing consent) con email nota (max 250 destinatari per
              invocazione). Idempotency: <code className="text-xs">campaign:segment:slug:user_id</code>. Nessun
              invio diretto: solo righe <code className="text-xs">pending</code> processate dal worker outbox.
            </p>
            {campaignAttempted != null ? (
              <p className="mt-2 text-sm text-emerald-700">
                Ultima campagna: {campaignAttempted} destinatari considerati
                {campaignErrors != null ? ` · errori enqueue: ${campaignErrors}` : ""}.
              </p>
            ) : null}
            <form action={runNewsletterCampaignEnqueue} className="mt-4 grid max-w-lg gap-3">
              <div className="grid gap-2">
                <Label htmlFor="comms_campaign_id">Usa record salvato (opzionale)</Label>
                <select
                  id="comms_campaign_id"
                  name="comms_campaign_id"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  defaultValue=""
                >
                  <option value="">— Nessuno: compila manualmente sotto —</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.slug} — {c.title}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-foreground/55">
                  Se scegli un record, slug/segmento/copy provengono dal DB (oggetto:{" "}
                  <code className="text-xs">subject_line</code> o titolo interno).
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="campaign_segment">Segmento destinatari</Label>
                <select
                  id="campaign_segment"
                  name="campaign_segment"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  defaultValue="newsletter_opt_in"
                >
                  <option value="newsletter_opt_in">Newsletter opt-in</option>
                  <option value="marketing_consent">Marketing consent (profilo)</option>
                  <option value="registration_waitlisted">Iscritti in lista d&apos;attesa (waitlisted)</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="campaign_id">ID campagna (slug, es. estate-2026)</Label>
                <Input
                  id="campaign_id"
                  name="campaign_id"
                  required
                  maxLength={64}
                  placeholder="estate-2026"
                  className="font-mono text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="campaign_subject">Oggetto email</Label>
                <Input
                  id="campaign_subject"
                  name="campaign_subject"
                  required
                  maxLength={120}
                  placeholder="Mana Nero — novità in negozio"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="campaign_teaser">Testo (opzionale, righe = paragrafi)</Label>
                <textarea
                  id="campaign_teaser"
                  name="campaign_teaser"
                  rows={4}
                  maxLength={2000}
                  className="min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Breve messaggio per i clienti iscritti alla newsletter…"
                />
              </div>
              <SubmitButton pendingLabel="Accodamento…">Accoda campagna segmentata</SubmitButton>
            </form>
          </div>

          <div className="border-t border-border/60 pt-6">
            <p className="text-sm font-medium text-foreground/90">Registro campagne (metadati DB)</p>
            <p className="mt-1 text-xs text-foreground/60">
              Tabella <code className="rounded bg-secondary px-1 text-xs">comms_campaigns</code>: traccia slug e
              copy per audit; l&apos;enqueue outbox resta dal form sopra (stesso slug consigliato per coerenza).
            </p>
            {campaigns.length === 0 ? (
              <p className="mt-2 text-sm text-foreground/70">Nessun record ancora.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {campaigns.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/50 px-3 py-2"
                  >
                    <span>
                      <span className="font-mono text-xs">{c.slug}</span> · {c.title}{" "}
                      <span className="text-foreground/55">({c.segment_kind})</span>
                    </span>
                    <Link
                      href={`/admin/comms?campaign_slug=${encodeURIComponent(c.slug)}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Storico outbox
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <form action={saveCommsCampaignRecord} className="mt-4 grid max-w-lg gap-3">
              <div className="grid gap-2">
                <Label htmlFor="record_slug">Slug campagna</Label>
                <Input
                  id="record_slug"
                  name="record_slug"
                  required
                  maxLength={64}
                  placeholder="estate-2026"
                  className="font-mono text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="record_title">Titolo interno</Label>
                <Input id="record_title" name="record_title" required maxLength={200} placeholder="Campagna estate" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="record_segment">Segmento</Label>
                <select
                  id="record_segment"
                  name="record_segment"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  defaultValue="newsletter_opt_in"
                >
                  <option value="newsletter_opt_in">newsletter_opt_in</option>
                  <option value="marketing_consent">marketing_consent</option>
                  <option value="registration_waitlisted">registration_waitlisted</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="record_subject">Oggetto (opzionale)</Label>
                <Input id="record_subject" name="record_subject" maxLength={200} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="record_teaser">Teaser (opzionale)</Label>
                <textarea
                  id="record_teaser"
                  name="record_teaser"
                  rows={3}
                  maxLength={2000}
                  className="min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <SubmitButton pendingLabel="Salvataggio…">Salva record campagna</SubmitButton>
            </form>
          </div>

          {campaignSlug ? (
            <div className="border-t border-border/60 pt-6">
              <p className="text-sm font-medium text-foreground/90">
                Storico outbox per slug <span className="font-mono text-xs">{campaignSlug}</span>
              </p>
              <p className="mt-1 text-xs text-foreground/60">
                Righe canale email con <code className="text-xs">payload.campaign_id</code> uguale allo slug.
              </p>
              <Link href="/admin/comms" className="mt-2 inline-block text-xs text-primary hover:underline">
                Chiudi storico
              </Link>
              {campaignHistory.length === 0 ? (
                <p className="mt-3 text-sm text-foreground/70">Nessuna riga outbox per questo slug.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[320px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-foreground/65">
                        <th className="py-2 pr-3 font-medium">Creato</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                        <th className="py-2 pr-3 font-medium">Tipo</th>
                        <th className="py-2 pr-3 font-medium">Oggetto</th>
                        <th className="py-2 font-medium">Dettaglio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignHistory.map((row) => (
                        <tr key={row.id} className="border-b border-border/40 align-top">
                          <td className="py-2 pr-3 text-xs text-foreground/70">{formatDateTime(row.created_at)}</td>
                          <td className="py-2 pr-3">{row.status}</td>
                          <td className="py-2 pr-3 text-sm text-foreground/85">{formatOutboxTimelineTitle(row)}</td>
                          <td className="py-2 pr-3 text-xs text-foreground/75">
                            {typeof row.payload?.subject_line === "string" ? row.payload.subject_line : "—"}
                          </td>
                          <td className="max-w-[min(28rem,45vw)] py-2 text-xs text-foreground/65">
                            {formatOutboxTimelineDetail(row)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
