"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CSV_IMPORT_SOURCES,
  CSV_IMPORT_SOURCE_LABELS,
  type CsvImportSource,
} from "@/lib/imports/tournament-results-csv";

import {
  commitImportAction,
  previewImportAction,
  type CommitActionResult,
  type PreviewActionResult,
} from "./actions";

type Props = { eventId: string };

const EXAMPLE_GENERIC = [
  "display_name,final_rank,wins,losses,draws,points",
  "Mario Rossi,1,4,0,0,12",
  "Luigi Verdi,2,3,1,0,9",
  "Walk In Wonder,3,2,2,0,6",
].join("\n");

export function ImportClient({ eventId }: Props) {
  const [csv, setCsv] = useState("");
  const [source, setSource] = useState<CsvImportSource | "auto">("auto");
  const [format, setFormat] = useState("");
  const [preview, setPreview] = useState<PreviewActionResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("event_id", eventId);
    fd.set("csv", csv);
    fd.set("source", source);
    if (format.trim()) fd.set("format", format.trim());
    return fd;
  }

  function handlePreview() {
    setCommitResult(null);
    startTransition(async () => {
      const result = await previewImportAction(buildFormData());
      setPreview(result);
    });
  }

  function handleCommit() {
    startTransition(async () => {
      const result = await commitImportAction(buildFormData());
      setCommitResult(result);
      if (result.ok) setPreview(null);
    });
  }

  const previewOk = preview?.ok ? preview : null;

  return (
    <div className="grid gap-6">
      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>1. Sorgente CSV</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="source">Source</Label>
              <select
                id="source"
                name="source"
                value={source}
                onChange={(e) => setSource(e.target.value as CsvImportSource | "auto")}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="auto">Auto-detect dagli header</option>
                {CSV_IMPORT_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {CSV_IMPORT_SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="format">Formato torneo (opzionale)</Label>
              <Input
                id="format"
                name="format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                placeholder="es. Modern, Standard, Expanded"
              />
              <p className="text-xs text-foreground/55">
                Sovrascrive la colonna <code>format</code> del CSV se presente.
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="csv">CSV</Label>
            <textarea
              id="csv"
              name="csv"
              rows={10}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={EXAMPLE_GENERIC}
              className="min-h-32 rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-foreground/55">
              Massimo 1000 righe per import. Per file più grandi splittare in
              più batch.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={handlePreview}
              disabled={isPending || csv.trim().length === 0}
            >
              {isPending ? "Analisi..." : "Anteprima"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCsv(EXAMPLE_GENERIC);
                setSource("generic");
              }}
            >
              Carica esempio
            </Button>
            {(csv || preview) && !isPending ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCsv("");
                  setPreview(null);
                  setCommitResult(null);
                }}
              >
                Pulisci
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {preview && !preview.ok ? (
        <Card className="border-destructive/60 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">Errore preview</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-destructive">
            {preview.reason}
          </CardContent>
        </Card>
      ) : null}

      {previewOk ? (
        <Card className="border-border/70 bg-card/85">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">Preview</Badge>
              <Badge variant="outline">
                Source: {CSV_IMPORT_SOURCE_LABELS[previewOk.source]}
              </Badge>
              <Badge variant="outline">
                {previewOk.preview.total_participants} righe
              </Badge>
              <Badge variant="outline">
                {previewOk.preview.auto_link_count} auto-link
              </Badge>
              <Badge variant="outline">
                {previewOk.preview.walk_in_count} walk-in
              </Badge>
              {previewOk.parse_errors.length > 0 ? (
                <Badge variant="outline" className="border-amber-400/60 text-amber-200">
                  {previewOk.parse_errors.length} righe scartate
                </Badge>
              ) : null}
            </div>
            <CardTitle>2. Verifica e conferma</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {previewOk.parse_errors.length > 0 ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                <p className="font-medium">Righe scartate dal parser:</p>
                <ul className="mt-2 grid gap-1 text-xs">
                  {previewOk.parse_errors.slice(0, 10).map((e, i) => (
                    <li key={`${e.source_row}-${i}`}>
                      Riga {e.source_row}: {e.reason}
                    </li>
                  ))}
                  {previewOk.parse_errors.length > 10 ? (
                    <li>… e altre {previewOk.parse_errors.length - 10}.</li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-border/60">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/40 text-[11px] uppercase tracking-[0.18em] text-foreground/55">
                  <tr>
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Giocatore</th>
                    <th className="px-4 py-2">Profilo</th>
                    <th className="px-4 py-2 text-right">W/L/D</th>
                    <th className="px-4 py-2 text-right">Punti</th>
                    <th className="px-4 py-2">Handle</th>
                  </tr>
                </thead>
                <tbody>
                  {previewOk.preview.rows.map((row) => (
                    <tr
                      key={`${row.source_row}-${row.display_name}`}
                      className="border-t border-border/50"
                    >
                      <td className="px-4 py-2 tabular-nums">{row.final_rank}</td>
                      <td className="px-4 py-2 font-medium">{row.display_name}</td>
                      <td className="px-4 py-2 text-foreground/65">
                        {row.proposed_profile_id ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs text-emerald-200">
                              auto-link
                            </span>
                            {row.proposed_profile_label ?? row.proposed_profile_id.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="text-foreground/45">walk-in</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {row.wins}/{row.losses}/{row.draws}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {row.resolved_points}
                      </td>
                      <td className="px-4 py-2 text-xs text-foreground/55">
                        {row.external_handle ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <Button
                type="button"
                onClick={handleCommit}
                disabled={isPending || previewOk.preview.rows.length === 0}
              >
                {isPending
                  ? "Importazione..."
                  : `Conferma import di ${previewOk.preview.rows.length} righe`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {commitResult ? (
        commitResult.ok ? (
          <Card className="border-emerald-400/30 bg-emerald-400/10">
            <CardHeader>
              <CardTitle className="text-emerald-200">Import completato</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-emerald-100">
              <p>
                Inserite/aggiornate{" "}
                <span className="font-semibold">{commitResult.inserted_or_updated}</span>{" "}
                righe su {commitResult.total} (auto-link {commitResult.auto_link_count}, walk-in{" "}
                {commitResult.walk_in_count}).
              </p>
              {commitResult.failed.length > 0 ? (
                <div>
                  <p className="font-medium">Errori:</p>
                  <ul className="mt-1 grid gap-1 text-xs">
                    {commitResult.failed.map((f, i) => (
                      <li key={`${f.source_row}-${i}`}>
                        Riga {f.source_row} ({f.display_name}): {f.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="text-xs text-emerald-200/80">
                Vai allo{" "}
                <a
                  href={`/admin/events/${eventId}/scoring`}
                  className="underline"
                >
                  scoring evento
                </a>{" "}
                per la lista aggiornata.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-destructive/60 bg-destructive/10">
            <CardHeader>
              <CardTitle className="text-destructive">Import non riuscito</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-destructive">
              {commitResult.reason}
            </CardContent>
          </Card>
        )
      ) : null}
    </div>
  );
}
