import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireUserWithRole } from "@/lib/gamestore/authz";
import { listAllGamePagesAdmin } from "@/lib/gamestore/data";
import { gamePageHeroUrl } from "@/lib/design/media";
import { saveGamePage } from "../actions";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminGamePagesPage({ searchParams }: PageProps) {
  const query = (await searchParams) ?? {};
  const editId = firstParam(query.edit);
  const { supabase } = await requireUserWithRole("staff");

  const pages = await listAllGamePagesAdmin(supabase);
  const editingPage = editId ? pages.find((p) => p.id === editId) ?? null : null;

  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      {firstParam(query.success) ? (
        <p className="col-span-full rounded-lg border border-emerald-200/80 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          Operazione completata.
        </p>
      ) : null}
      {firstParam(query.error) ? (
        <p className="col-span-full rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {firstParam(query.error)}
        </p>
      ) : null}
      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle>{editingPage ? "Modifica pagina gioco" : "Seleziona una pagina"}</CardTitle>
            {editingPage ? (
              <Link
                href="/admin/game-pages"
                className="text-sm font-medium text-primary hover:underline"
              >
                Annulla modifica
              </Link>
            ) : null}
          </div>
          <p className="text-sm text-foreground/65">
            Le pagine sono pre-create per slug; modifica testi, immagine hero e stato pubblicazione. L&apos;URL pubblico è{" "}
            <code className="rounded bg-muted px-1 text-xs">/giochi/[slug]</code>.
          </p>
        </CardHeader>
        <CardContent>
          {editingPage ? (
            <form action={saveGamePage} className="grid gap-4" key={editingPage.id}>
              <input type="hidden" name="id" value={editingPage.id} />
              <input type="hidden" name="slug" value={editingPage.slug} />
              <div className="grid gap-2">
                <Label htmlFor="slug_display">Slug (solo lettura)</Label>
                <Input id="slug_display" readOnly value={editingPage.slug} className="opacity-80" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="display_name">Nome visualizzato</Label>
                <Input
                  id="display_name"
                  name="display_name"
                  required
                  defaultValue={editingPage.display_name}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="eyebrow">Eyebrow (sopra titolo)</Label>
                <Input id="eyebrow" name="eyebrow" defaultValue={editingPage.eyebrow ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hero_title">Titolo hero</Label>
                <Input id="hero_title" name="hero_title" required defaultValue={editingPage.hero_title} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="intro">Intro (paragrafo sotto titolo)</Label>
                <textarea
                  id="intro"
                  name="intro"
                  rows={5}
                  className="min-h-28 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  defaultValue={editingPage.intro ?? ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="body">Corpo (testo lungo)</Label>
                <textarea
                  id="body"
                  name="body"
                  rows={10}
                  className="min-h-48 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  defaultValue={editingPage.body ?? ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hero_image_path">Percorso immagine (bucket o /public/...)</Label>
                <Input
                  id="hero_image_path"
                  name="hero_image_path"
                  placeholder="/images/game-pages/magic-the-gathering-hero.jpg"
                  defaultValue={editingPage.hero_image_path ?? ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cover_image">Carica nuova hero</Label>
                <Input id="cover_image" name="cover_image" type="file" accept="image/jpeg,image/png,image/webp" />
                <p className="text-xs text-foreground/60">
                  JPG/PNG/WEBP, max 5MB. Se carichi un file, sostituisce il percorso manuale.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sort_order">Ordine (hub)</Label>
                <Input
                  id="sort_order"
                  name="sort_order"
                  type="number"
                  defaultValue={String(editingPage.sort_order)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Stato</Label>
                <select
                  id="status"
                  name="status"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  defaultValue={editingPage.status}
                >
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                  <option value="archived">archived</option>
                </select>
              </div>
              <SubmitButton className="w-fit" pendingLabel="Salvataggio...">
                Salva pagina gioco
              </SubmitButton>
            </form>
          ) : (
            <p className="text-sm text-foreground/70">
              Scegli &quot;Modifica&quot; su una delle pagine a destra per aggiornare contenuti e immagine.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>Pagine gioco</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pages.length === 0 ? (
            <p className="text-sm text-foreground/70">Nessuna riga in game_pages. Esegui la migration SQL.</p>
          ) : (
            pages.map((row) => {
              const thumb = gamePageHeroUrl(row.hero_image_path);
              return (
                <div key={row.id} className="overflow-hidden rounded-2xl bg-secondary/70">
                  <div
                    className="h-28 w-full bg-muted"
                    style={{
                      backgroundImage: `linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 100%), url(${thumb})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <div className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{row.display_name}</p>
                        <p className="text-sm text-foreground/65">{row.slug}</p>
                      </div>
                      <Badge variant="outline">{row.status}</Badge>
                    </div>
                    {row.hero_image_path ? (
                      <p className="mt-2 text-xs text-foreground/55 break-all">img: {row.hero_image_path}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Link
                        href={`/admin/game-pages?edit=${row.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Modifica
                      </Link>
                      <Link
                        href={`/giochi/${row.slug}`}
                        className="text-sm font-medium text-foreground/70 hover:text-foreground hover:underline"
                      >
                        Anteprima pubblica
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </section>
  );
}
