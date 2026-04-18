"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

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
import type { ProfileSearchResult } from "@/lib/domain/profile-search";

import {
  commitImportAction,
  previewImportAction,
  searchProfilesAction,
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

type RowAction = "keep" | "walk_in" | "link_to_profile" | "skip";

type Override = {
  action: RowAction;
  profile_id: string | null;
  /** Etichetta cached per render (full_name/email del profilo agganciato). */
  profile_label: string | null;
};

type Overrides = Map<number, Override>;

function buildOverridesPayload(map: Overrides): string {
  const obj: Record<string, { action: RowAction; profile_id: string | null }> = {};
  for (const [key, value] of map.entries()) {
    if (value.action === "keep") continue;
    obj[String(key)] = {
      action: value.action,
      profile_id: value.profile_id,
    };
  }
  return JSON.stringify(obj);
}

function profileLabel(p: ProfileSearchResult): string {
  return p.full_name || p.email || p.id.slice(0, 8);
}

function profileSecondary(p: ProfileSearchResult): string {
  const parts: string[] = [];
  if (p.email && p.full_name) parts.push(p.email);
  if (p.external_handles.length > 0) {
    parts.push(
      p.external_handles
        .map((h) => `${h.platform}:${h.external_id || h.external_username || "—"}`)
        .join(" · "),
    );
  }
  return parts.join(" · ");
}

export function ImportClient({ eventId }: Props) {
  const [csv, setCsv] = useState("");
  const [source, setSource] = useState<CsvImportSource | "auto">("auto");
  const [format, setFormat] = useState("");
  const [preview, setPreview] = useState<PreviewActionResult | null>(null);
  const [overrides, setOverrides] = useState<Overrides>(new Map());
  const [commitResult, setCommitResult] = useState<CommitActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement | null>(null);

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("event_id", eventId);
    fd.set("csv", csv);
    fd.set("source", source);
    if (format.trim()) fd.set("format", format.trim());
    fd.set("overrides_json", buildOverridesPayload(overrides));
    const file = fileRef.current?.files?.[0];
    if (file && file.size > 0) fd.set("csv_file", file);
    return fd;
  }

  function handlePreview() {
    setCommitResult(null);
    setOverrides(new Map());
    startTransition(async () => {
      const result = await previewImportAction(buildFormData());
      setPreview(result);
    });
  }

  function handleCommit() {
    startTransition(async () => {
      const result = await commitImportAction(buildFormData());
      setCommitResult(result);
      if (result.ok) {
        setPreview(null);
        setOverrides(new Map());
      }
    });
  }

  function setRowOverride(sourceRow: number, next: Partial<Override> | null) {
    setOverrides((prev) => {
      const map = new Map(prev);
      if (next === null) {
        map.delete(sourceRow);
        return map;
      }
      const current = map.get(sourceRow) ?? {
        action: "keep",
        profile_id: null,
        profile_label: null,
      };
      map.set(sourceRow, { ...current, ...next });
      return map;
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
            <Label htmlFor="csv_file">File CSV (opzionale)</Label>
            <input
              ref={fileRef}
              id="csv_file"
              name="csv_file"
              type="file"
              accept=".csv,text/csv"
              className="text-xs text-foreground/70"
            />
            <p className="text-xs text-foreground/55">
              In alternativa al paste qui sotto. Max 2 MB.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="csv">CSV (paste)</Label>
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
              disabled={
                isPending ||
                (csv.trim().length === 0 &&
                  !(fileRef.current?.files?.[0]?.size ?? 0))
              }
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
                  setOverrides(new Map());
                  if (fileRef.current) fileRef.current.value = "";
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
              {overrides.size > 0 ? (
                <Badge
                  variant="outline"
                  className="border-amber-400/60 text-amber-200"
                >
                  {overrides.size} override
                </Badge>
              ) : null}
              {previewOk.parse_errors.length > 0 ? (
                <Badge variant="outline" className="border-amber-400/60 text-amber-200">
                  {previewOk.parse_errors.length} righe scartate
                </Badge>
              ) : null}
            </div>
            <CardTitle>2. Verifica, modifica e conferma</CardTitle>
            <p className="text-sm text-foreground/65">
              Per ogni riga puoi confermare l&apos;auto-link, forzare un
              walk-in, collegare manualmente a un profilo Mana Nero (search) o
              saltare la riga.
            </p>
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

            <div className="grid gap-3">
              {previewOk.preview.rows.map((row) => {
                const ov = overrides.get(row.source_row);
                const action: RowAction = ov?.action ?? "keep";
                return (
                  <PreviewRowEditor
                    key={`${row.source_row}-${row.display_name}`}
                    row={{
                      source_row: row.source_row,
                      display_name: row.display_name,
                      final_rank: row.final_rank,
                      wins: row.wins,
                      losses: row.losses,
                      draws: row.draws,
                      resolved_points: row.resolved_points,
                      external_handle: row.external_handle,
                      proposed_profile_id: row.proposed_profile_id,
                      proposed_profile_label: row.proposed_profile_label,
                    }}
                    action={action}
                    override={ov ?? null}
                    onChange={(next) =>
                      setRowOverride(row.source_row, next === null ? null : next)
                    }
                  />
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={handleCommit}
                disabled={isPending || previewOk.preview.rows.length === 0}
              >
                {isPending
                  ? "Importazione..."
                  : `Conferma import di ${previewOk.preview.rows.length} righe${
                      overrides.size > 0 ? ` (${overrides.size} override)` : ""
                    }`}
              </Button>
              {overrides.size > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOverrides(new Map())}
                >
                  Reset override
                </Button>
              ) : null}
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
                {commitResult.walk_in_count}, salti {commitResult.skipped}).
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

type PreviewRowMin = {
  source_row: number;
  display_name: string;
  final_rank: number;
  wins: number;
  losses: number;
  draws: number;
  resolved_points: number;
  external_handle: string | null;
  proposed_profile_id: string | null;
  proposed_profile_label: string | null;
};

function PreviewRowEditor({
  row,
  action,
  override,
  onChange,
}: {
  row: PreviewRowMin;
  action: RowAction;
  override: Override | null;
  onChange: (next: Partial<Override> | null) => void;
}) {
  const isAutoLinked = !!row.proposed_profile_id;
  const effectiveLabel = useMemo(() => {
    if (action === "skip") return "Salta";
    if (action === "walk_in") return "Walk-in (forzato)";
    if (action === "link_to_profile") {
      return override?.profile_label ?? "Collega a profilo…";
    }
    return isAutoLinked
      ? row.proposed_profile_label ?? "Auto-link"
      : "Walk-in";
  }, [action, override?.profile_label, isAutoLinked, row.proposed_profile_label]);

  const stateBadgeClass =
    action === "skip"
      ? "bg-foreground/10 text-foreground/55"
      : action === "walk_in"
        ? "bg-amber-400/15 text-amber-100"
        : action === "link_to_profile"
          ? "bg-cyan-400/15 text-cyan-100"
          : isAutoLinked
            ? "bg-emerald-400/15 text-emerald-200"
            : "bg-foreground/10 text-foreground/55";

  return (
    <div
      className={`grid gap-3 rounded-2xl border border-border/60 bg-background/40 p-4 ${
        action === "skip" ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full bg-secondary/60 px-2 py-0.5 font-mono text-xs text-foreground/70">
          #{row.final_rank}
        </span>
        <span className="font-medium">{row.display_name}</span>
        <span className="text-xs text-foreground/55">
          W/L/D {row.wins}/{row.losses}/{row.draws} · {row.resolved_points} pt
          {row.external_handle ? ` · handle ${row.external_handle}` : ""}
        </span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-xs ${stateBadgeClass}`}>
          {effectiveLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`rounded-full border px-3 py-1 ${
            action === "keep"
              ? "border-primary text-primary"
              : "border-border/60 text-foreground/65 hover:text-foreground"
          }`}
        >
          {isAutoLinked ? "Conferma auto-link" : "Conferma walk-in"}
        </button>
        <button
          type="button"
          onClick={() => onChange({ action: "walk_in", profile_id: null, profile_label: null })}
          className={`rounded-full border px-3 py-1 ${
            action === "walk_in"
              ? "border-amber-300 text-amber-200"
              : "border-border/60 text-foreground/65 hover:text-foreground"
          }`}
          disabled={!isAutoLinked && action !== "link_to_profile"}
          title={
            !isAutoLinked
              ? "Già walk-in: usa 'Collega a profilo' per linkare un profilo."
              : "Forza walk-in (rimuove l'auto-link)"
          }
        >
          Forza walk-in
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({
              action: "link_to_profile",
              profile_id: override?.profile_id ?? null,
              profile_label: override?.profile_label ?? null,
            })
          }
          className={`rounded-full border px-3 py-1 ${
            action === "link_to_profile"
              ? "border-cyan-300 text-cyan-200"
              : "border-border/60 text-foreground/65 hover:text-foreground"
          }`}
        >
          Collega a profilo
        </button>
        <button
          type="button"
          onClick={() => onChange({ action: "skip", profile_id: null, profile_label: null })}
          className={`rounded-full border px-3 py-1 ${
            action === "skip"
              ? "border-foreground/40 text-foreground/65"
              : "border-border/60 text-foreground/65 hover:text-foreground"
          }`}
        >
          Salta
        </button>
      </div>

      {action === "link_to_profile" ? (
        <ProfilePicker
          value={
            override?.profile_id
              ? {
                  id: override.profile_id,
                  label: override.profile_label ?? override.profile_id.slice(0, 8),
                }
              : null
          }
          onSelect={(p) =>
            onChange({
              action: "link_to_profile",
              profile_id: p.id,
              profile_label: profileLabel(p),
            })
          }
          onClear={() =>
            onChange({ action: "link_to_profile", profile_id: null, profile_label: null })
          }
        />
      ) : null}
    </div>
  );
}

function ProfilePicker({
  value,
  onSelect,
  onClear,
}: {
  value: { id: string; label: string } | null;
  onSelect: (p: ProfileSearchResult) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const fd = new FormData();
      fd.set("query", trimmed);
      const result = await searchProfilesAction(fd);
      if (cancelled) return;
      setLoading(false);
      if (result.ok) setResults(result.profiles);
      else setResults([]);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="grid gap-2 rounded-xl border border-border/60 bg-card/60 p-3">
      {value ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-xs text-cyan-100">
            collegato
          </span>
          <span className="font-medium">{value.label}</span>
          <span className="font-mono text-xs text-foreground/55">{value.id.slice(0, 8)}</span>
          <button
            type="button"
            onClick={onClear}
            className="ml-auto text-xs text-foreground/55 hover:text-destructive"
          >
            Rimuovi link
          </button>
        </div>
      ) : null}
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca per nome, email o telegram (min 2 caratteri)"
        className="h-9 text-sm"
      />
      {loading ? (
        <p className="text-xs text-foreground/55">Ricerca in corso…</p>
      ) : null}
      {!loading && query.trim().length >= 2 && results.length === 0 ? (
        <p className="text-xs text-foreground/55">Nessun profilo trovato.</p>
      ) : null}
      {results.length > 0 ? (
        <ul className="grid divide-y divide-border/40">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p);
                  setQuery("");
                  setResults([]);
                }}
                className="flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left hover:bg-secondary/40"
              >
                <span className="text-sm font-medium">{profileLabel(p)}</span>
                <span className="text-xs text-foreground/55">
                  {profileSecondary(p) || p.id.slice(0, 8)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
