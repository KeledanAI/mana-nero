import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserWithRole } from "@/lib/gamestore/authz";
import { getEventCategoryForEvent } from "@/lib/gamestore/data";

import { ImportClient } from "./import-client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminEventImportPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase } = await requireUserWithRole("staff");
  const [{ data: event }, category] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, slug, starts_at, capacity, status")
      .eq("id", id)
      .maybeSingle(),
    getEventCategoryForEvent(supabase, id),
  ]);
  if (!event) notFound();

  return (
    <section className="grid gap-6">
      <nav className="text-sm text-foreground/65">
        <Link
          href={`/admin/events/${event.id}/scoring`}
          className="font-medium text-primary hover:underline"
        >
          ← Torna allo scoring
        </Link>
      </nav>

      <Card className="border-border/70 bg-card/85">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Import CSV risultati</Badge>
            {category ? <Badge variant="outline">{category.name}</Badge> : null}
          </div>
          <CardTitle className="text-2xl">{event.title}</CardTitle>
          <p className="text-sm leading-7 text-foreground/65">
            Incolla l&apos;export CSV del software ufficiale (Wizards EventLink,
            Play! Pokémon, Bandai TCG+) o un CSV generico. Le righe vengono
            collegate ai profili Mana Nero che hanno dichiarato l&apos;account
            esterno corrispondente; le altre vengono importate come walk-in.
            L&apos;operazione è idempotente: re-eseguirla aggiorna i risultati
            invece di duplicarli.
          </p>
        </CardHeader>
        <CardContent className="grid gap-2 text-xs text-foreground/55">
          <p>
            Header riconosciuti: <code>display_name / name / player</code> +{" "}
            <code>final_rank / rank / standing / placement</code> +{" "}
            <code>wins / w</code>, <code>losses / l</code>,{" "}
            <code>draws / d / ties</code>, <code>points / match_points</code>,{" "}
            <code>dci / playerid / bnid</code>, <code>format</code>. Separatore
            virgola o punto-e-virgola, BOM gestito.
          </p>
        </CardContent>
      </Card>

      <ImportClient eventId={event.id} />
    </section>
  );
}
