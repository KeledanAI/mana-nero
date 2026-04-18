"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdapterDescriptor } from "@/lib/imports/adapters";

import {
  fetchRemoteCsvAction,
  listAdaptersAction,
  type FetchRemoteResult,
} from "./actions";

type Props = {
  /** Callback chiamato quando il CSV remoto è pronto. Popola la textarea principale. */
  onCsvFetched: (csv: string, sourceHint: string) => void;
};

const STATUS_LABEL: Record<AdapterDescriptor["status"], string> = {
  available: "Disponibile",
  manual_only: "Solo manuale",
  requires_partnership: "Richiede partnership",
};

const STATUS_COLOR: Record<AdapterDescriptor["status"], string> = {
  available: "bg-emerald-400/15 text-emerald-200",
  manual_only: "bg-foreground/10 text-foreground/65",
  requires_partnership: "bg-amber-400/15 text-amber-100",
};

export function RemoteFetchPanel({ onCsvFetched }: Props) {
  const [adapters, setAdapters] = useState<AdapterDescriptor[]>([]);
  const [adapterId, setAdapterId] = useState<string>("remote_csv_url");
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<FetchRemoteResult | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listAdaptersAction().then((r) => setAdapters(r.adapters));
  }, []);

  const selected = adapters.find((a) => a.id === adapterId);
  const isAvailable = selected?.status === "available";

  function handleFetch() {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("adapter", adapterId);
      fd.set("reference", reference);
      const r = await fetchRemoteCsvAction(fd);
      setResult(r);
      if (r.ok) onCsvFetched(r.csv_text, r.source);
    });
  }

  return (
    <Card className="border-border/70 bg-card/85">
      <CardHeader>
        <CardTitle>Sync da fonte remota</CardTitle>
        <p className="text-sm text-foreground/65">
          Scarica un CSV da una fonte esterna (URL pubblico) e popola
          automaticamente l&apos;area paste qui sopra. Per le piattaforme
          ufficiali senza API pubblica trovi qui sotto le istruzioni di export
          manuale.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div className="grid gap-2">
            <Label htmlFor="adapter">Fonte</Label>
            <select
              id="adapter"
              value={adapterId}
              onChange={(e) => {
                setAdapterId(e.target.value);
                setResult(null);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {adapters.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label className="text-foreground/55">Stato</Label>
            {selected ? (
              <span
                className={`inline-flex items-center self-start rounded-full px-3 py-1 text-xs ${
                  STATUS_COLOR[selected.status]
                }`}
              >
                {STATUS_LABEL[selected.status]}
              </span>
            ) : (
              <span className="text-xs text-foreground/45">—</span>
            )}
          </div>
        </div>

        {selected ? (
          <div className="rounded-2xl border border-border/60 bg-background/40 p-4 text-sm">
            <p className="text-foreground/80">{selected.description}</p>
            <p className="mt-3 text-xs text-foreground/55">
              <span className="font-medium text-foreground/70">Istruzioni:</span>{" "}
              {selected.manual_instructions}
            </p>
          </div>
        ) : null}

        {isAvailable ? (
          <div className="grid gap-2">
            <Label htmlFor="reference">URL HTTPS del CSV</Label>
            <Input
              id="reference"
              type="url"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
            />
            <p className="text-xs text-foreground/55">
              Solo HTTPS verso domini pubblici. Max 5 MB.
            </p>
            <div>
              <Button
                type="button"
                onClick={handleFetch}
                disabled={isPending || reference.trim().length === 0}
              >
                {isPending ? "Scaricamento..." : "Scarica e popola la preview"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
            Sync diretto non disponibile per questa fonte. Esegui l&apos;export
            manuale come da istruzioni e usa il tab &quot;CSV&quot;.
          </p>
        )}

        {result && !result.ok ? (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            Errore: {result.reason}
          </p>
        ) : null}
        {result && result.ok ? (
          <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-100">
            CSV scaricato (
            {result.fetched_url ? new URL(result.fetched_url).hostname : "—"}
            ). È stato copiato nell&apos;area paste qui sopra: clicca
            &quot;Anteprima&quot; per analizzarlo.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
