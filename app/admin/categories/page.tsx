import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireUserWithRole } from "@/lib/gamestore/authz";
import { deleteEventCategory, saveEventCategory } from "../actions";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminCategoriesPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const editId = firstParam(params.edit);
  const { supabase } = await requireUserWithRole("staff");

  const [{ data: categories }, { data: editing }] = await Promise.all([
    supabase.from("event_categories").select("id, name, slug, description").order("name"),
    editId
      ? supabase.from("event_categories").select("id, name, slug, description").eq("id", editId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle>{editing ? "Modifica categoria" : "Nuova categoria"}</CardTitle>
            {editing ? (
              <Link href="/admin/categories" className="text-sm font-medium text-primary hover:underline">
                Annulla modifica
              </Link>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <form action={saveEventCategory} className="grid gap-4" key={editing?.id ?? "new"}>
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <div className="grid gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" required defaultValue={editing?.name ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" required defaultValue={editing?.slug ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descrizione</Label>
              <textarea
                id="description"
                name="description"
                rows={4}
                className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                defaultValue={editing?.description ?? ""}
              />
            </div>
            <SubmitButton className="w-fit" pendingLabel="Salvataggio...">
              {editing ? "Aggiorna categoria" : "Crea categoria"}
            </SubmitButton>
            {firstParam(params.success) ? (
              <p className="text-sm text-emerald-700">{firstParam(params.success)}</p>
            ) : null}
            {firstParam(params.error) ? (
              <p className="text-sm text-destructive">{firstParam(params.error)}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>Categorie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(categories ?? []).length === 0 ? (
            <p className="text-sm text-foreground/70">Nessuna categoria. Creane una per organizzare gli eventi.</p>
          ) : (
            (categories ?? []).map((category) => (
              <div key={category.id} className="rounded-2xl bg-secondary/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-sm text-foreground/65">{category.slug}</p>
                  </div>
                  <Link
                    href={`/admin/categories?edit=${category.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Modifica
                  </Link>
                </div>
                {category.description ? (
                  <p className="mt-2 text-sm text-foreground/70">{category.description}</p>
                ) : null}
                <form action={deleteEventCategory} className="mt-3">
                  <input type="hidden" name="id" value={category.id} />
                  <SubmitButton variant="outline" pendingLabel="Eliminazione...">
                    Elimina
                  </SubmitButton>
                </form>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
