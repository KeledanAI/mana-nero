import Link from "next/link";

import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserWithRole } from "@/lib/gamestore/authz";

import { runEventReminderScan } from "../actions";

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

  const { data: statsRaw, error: statsError } = await supabase.rpc("outbox_email_stats_for_staff");
  const statsRows: OutboxEmailStatRow[] = Array.isArray(statsRaw)
    ? (statsRaw as OutboxEmailStatRow[])
    : [];

  const events = firstParam(params.events);
  const attempted = firstParam(params.attempted);

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
                      <th className="py-2 pr-3 font-medium">Kind</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 font-medium">N</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsRows.map((row) => (
                      <tr key={`${row.kind}:${row.status}`} className="border-b border-border/40">
                        <td className="py-2 pr-3 font-mono text-xs">{row.kind}</td>
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

          <form action={runEventReminderScan}>
            <SubmitButton pendingLabel="Scansione in corso…">Esegui scan reminder 24h ora</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
