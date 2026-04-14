import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserWithRole } from "@/lib/gamestore/authz";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type StaffSummaryJson = {
  events_published?: number;
  events_draft?: number;
  events_cancelled?: number;
  registrations_total?: number;
  registrations_confirmed?: number;
  registrations_waitlisted?: number;
  registrations_cancelled?: number;
  registrations_checked_in?: number;
  registrations_pending_payment?: number;
  outbox_email_pending?: number;
  product_requests_total?: number;
  product_awaiting_stock?: number;
};

function parseDays(raw: string | undefined): number {
  if (raw === "all" || raw === "0") return 0;
  const n = Number.parseInt(String(raw ?? "30"), 10);
  if (!Number.isFinite(n) || n < 1) return 30;
  return Math.min(366, n);
}

function sinceIsoFromDays(days: number): string | null {
  if (days <= 0) return null;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function stat(n: number | null | undefined) {
  return String(n ?? 0);
}

export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const days = parseDays(firstParam(params.days));
  const sinceIso = sinceIsoFromDays(days);
  const { supabase } = await requireUserWithRole("staff");

  const [rpc, campaignRpc, waitlistRpc] = await Promise.all([
    supabase.rpc("analytics_staff_summary", { p_since: sinceIso }),
    supabase.rpc("analytics_outbox_campaign_segment_stats"),
    supabase.rpc("analytics_waitlist_registration_summary", { p_since: sinceIso }),
  ]);
  let summary: StaffSummaryJson | null = null;
  let rpcFailed = false;

  if (!rpc.error && rpc.data && typeof rpc.data === "object") {
    summary = rpc.data as StaffSummaryJson;
  } else {
    rpcFailed = true;
    const [
      publishedEvents,
      draftEvents,
      cancelledEvents,
      registrationsTotal,
      registrationsConfirmed,
      outboxEmailPending,
      productRequestsTotal,
      productAwaitingStock,
    ] = await Promise.all([
      supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "draft"),
      supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
      supabase.from("event_registrations").select("id", { count: "exact", head: true }),
      supabase.from("event_registrations").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
      supabase
        .from("communication_outbox")
        .select("id", { count: "exact", head: true })
        .eq("channel", "email")
        .eq("status", "pending"),
      supabase.from("product_reservation_requests").select("id", { count: "exact", head: true }),
      supabase.from("product_reservation_requests").select("id", { count: "exact", head: true }).eq("status", "awaiting_stock"),
    ]);
    summary = {
      events_published: publishedEvents.count ?? 0,
      events_draft: draftEvents.count ?? 0,
      events_cancelled: cancelledEvents.count ?? 0,
      registrations_total: registrationsTotal.count ?? 0,
      registrations_confirmed: registrationsConfirmed.count ?? 0,
      registrations_waitlisted: 0,
      registrations_cancelled: 0,
      registrations_checked_in: 0,
      registrations_pending_payment: 0,
      outbox_email_pending: outboxEmailPending.count ?? 0,
      product_requests_total: productRequestsTotal.count ?? 0,
      product_awaiting_stock: productAwaitingStock.count ?? 0,
    };
  }

  const s = summary ?? {};
  const tiles = [
    { label: "Eventi pubblicati", value: stat(s.events_published) },
    { label: "Eventi bozza", value: stat(s.events_draft) },
    { label: "Eventi annullati", value: stat(s.events_cancelled) },
    { label: "Iscrizioni (nel periodo)", value: stat(s.registrations_total) },
    { label: "Iscrizioni confermate", value: stat(s.registrations_confirmed) },
    { label: "Outbox email in pending", value: stat(s.outbox_email_pending) },
    { label: "Richieste prodotto (nel periodo)", value: stat(s.product_requests_total) },
    { label: "Richieste awaiting_stock", value: stat(s.product_awaiting_stock) },
  ];

  const regParts = [
    { key: "confirmed", label: "Confermate", n: Number(s.registrations_confirmed ?? 0) },
    { key: "waitlisted", label: "Waitlist", n: Number(s.registrations_waitlisted ?? 0) },
    { key: "cancelled", label: "Annullate", n: Number(s.registrations_cancelled ?? 0) },
    { key: "checked_in", label: "Check-in", n: Number(s.registrations_checked_in ?? 0) },
    { key: "pending_payment", label: "Pagamento pending", n: Number(s.registrations_pending_payment ?? 0) },
  ];
  const regMax = Math.max(1, ...regParts.map((p) => p.n));

  type CampaignSegRow = { status: string; n: number | string };
  const campaignRows: CampaignSegRow[] = Array.isArray(campaignRpc.data)
    ? (campaignRpc.data as CampaignSegRow[])
    : [];
  const waitlistSummary =
    !waitlistRpc.error && waitlistRpc.data && typeof waitlistRpc.data === "object"
      ? (waitlistRpc.data as Record<string, number>)
      : null;
  const wlWait = Number(waitlistSummary?.waitlisted ?? 0);
  const wlConf = Number(waitlistSummary?.confirmed ?? 0);
  const wlRatio =
    wlWait + wlConf > 0 ? `${Math.round((100 * wlConf) / (wlWait + wlConf))}% confermate sul totale waitlist+confermate` : "n/d";

  const rangeLinks = [
    { label: "7 giorni", days: "7" },
    { label: "30 giorni", days: "30" },
    { label: "90 giorni", days: "90" },
    { label: "Tutto", days: "all" },
  ];

  return (
    <section className="grid gap-6">
      <nav className="text-sm text-foreground/65">
        <Link href="/admin" className="font-medium text-primary hover:underline">
          ← Dashboard
        </Link>
      </nav>

      {rpcFailed ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-foreground/85">
          RPC <code className="text-xs">analytics_staff_summary</code> non disponibile: mostro conteggi legacy
          (senza breakdown iscrizioni). Applica la migrazione{" "}
          <code className="text-xs">20260419120000_analytics_staff_summary_for_staff.sql</code> con{" "}
          <code className="text-xs">supabase db push</code>.
        </p>
      ) : null}

      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>Analytics staff</CardTitle>
          <p className="text-sm font-normal text-foreground/65">
            Intervallo: iscrizioni, richieste prodotto e righe outbox <strong>pending</strong> filtrate da{" "}
            <code className="text-xs">created_at</code> (UTC) nel periodo. Eventi sempre totali per stato.
          </p>
          <div className="flex flex-wrap gap-2 pt-2 text-sm">
            {rangeLinks.map((l) => {
              const active = l.days === "all" ? days === 0 : Number(l.days) === days;
              return (
                <Link
                  key={l.days}
                  href={l.days === "all" ? "/admin/analytics?days=all" : `/admin/analytics?days=${l.days}`}
                  className={
                    active
                      ? "rounded-md border-2 border-primary px-3 py-1 font-medium text-foreground"
                      : "rounded-md border border-border/60 px-3 py-1 text-foreground/80 hover:bg-secondary/60"
                  }
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((t) => (
              <div
                key={t.label}
                className="rounded-xl border border-border/60 bg-secondary/40 px-4 py-3 text-sm"
              >
                <p className="text-foreground/65">{t.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{t.value}</p>
              </div>
            ))}
          </div>

          {campaignRpc.error ? (
            <p className="text-xs text-foreground/60">
              RPC <code className="text-xs">analytics_outbox_campaign_segment_stats</code> non disponibile (applica
              migrazione <code className="text-xs">20260420140000_*</code>).
            </p>
          ) : campaignRows.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-foreground/90">Outbox campagne segmentate (tutti i tempi)</p>
              <p className="mt-1 text-xs text-foreground/60">
                Righe email con <code className="text-xs">kind = campaign_segment</code>, raggruppate per stato.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[200px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-foreground/65">
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 font-medium">N</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignRows.map((row) => (
                      <tr key={row.status} className="border-b border-border/40">
                        <td className="py-2 pr-3">{row.status}</td>
                        <td className="py-2 tabular-nums">{Number(row.n)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground/70">Nessuna riga outbox campagna segmentata ancora.</p>
          )}

          {waitlistRpc.error ? (
            <p className="text-xs text-foreground/60">
              RPC <code className="text-xs">analytics_waitlist_registration_summary</code> non disponibile.
            </p>
          ) : waitlistSummary ? (
            <div>
              <p className="text-sm font-medium text-foreground/90">Funnel iscrizioni (nel periodo)</p>
              <p className="mt-1 text-xs text-foreground/60">
                Conteggi per stato su <code className="text-xs">event_registrations</code> nel periodo selezionato.
                Indicatore grezzo: {wlRatio}.
              </p>
              <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Waitlist", waitlistSummary.waitlisted],
                  ["Confermate", waitlistSummary.confirmed],
                  ["Check-in", waitlistSummary.checked_in],
                  ["Annullate", waitlistSummary.cancelled],
                  ["Pagamento pending", waitlistSummary.pending_payment],
                ].map(([label, val]) => (
                  <li key={String(label)} className="rounded-lg border border-border/50 bg-secondary/30 px-3 py-2">
                    <span className="text-foreground/65">{label}</span>
                    <p className="text-lg font-semibold tabular-nums">{stat(Number(val))}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!rpcFailed ? (
            <div>
              <p className="text-sm font-medium text-foreground/90">Iscrizioni per stato (nel periodo)</p>
              <p className="mt-1 text-xs text-foreground/60">Barre proporzionali al massimo nella serie.</p>
              <ul className="mt-4 space-y-3">
                {regParts.map((p) => (
                  <li key={p.key} className="grid gap-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-foreground/75">{p.label}</span>
                      <span className="tabular-nums text-foreground/90">{p.n}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary/80"
                        style={{ width: `${Math.round((p.n / regMax) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-sm text-foreground/65">
            Dettaglio outbox per tipo messaggio:{" "}
            <Link href="/admin/comms" className="font-medium text-primary hover:underline">
              Comunicazioni
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
