import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireUserWithRole } from "@/lib/gamestore/authz";
import { deletePost, savePost } from "../actions";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPostsPage({ searchParams }: PageProps) {
  const query = (await searchParams) ?? {};
  const editId = firstParam(query.edit);
  const { supabase } = await requireUserWithRole("staff");

  const [{ data: posts }, { data: editingPost }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, slug, status, published_at, cover_image_path")
      .order("updated_at", { ascending: false }),
    editId
      ? supabase
          .from("posts")
          .select("id, title, slug, body, status, published_at, cover_image_path")
          .eq("id", editId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle>{editingPost ? "Modifica post" : "Nuovo post"}</CardTitle>
            {editingPost ? (
              <Link href="/admin/posts" className="text-sm font-medium text-primary hover:underline">
                Annulla modifica
              </Link>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <form action={savePost} className="grid gap-4" key={editingPost?.id ?? "new"}>
            {editingPost ? <input type="hidden" name="id" value={editingPost.id} /> : null}
            <div className="grid gap-2">
              <Label htmlFor="title">Titolo</Label>
              <Input id="title" name="title" required defaultValue={editingPost?.title ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" required defaultValue={editingPost?.slug ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="body">Contenuto</Label>
              <textarea
                id="body"
                name="body"
                rows={8}
                className="min-h-36 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                defaultValue={editingPost?.body ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cover_image_path">Percorso immagine (bucket)</Label>
              <Input
                id="cover_image_path"
                name="cover_image_path"
                placeholder="posts/my-post/cover.jpg"
                defaultValue={editingPost?.cover_image_path ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cover_image">Carica nuova immagine</Label>
              <Input id="cover_image" name="cover_image" type="file" accept="image/jpeg,image/png,image/webp" />
              <p className="text-xs text-foreground/60">JPG/PNG/WEBP, max 5MB. Se carichi un file sovrascrive il percorso manuale.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Stato</Label>
              <select
                id="status"
                name="status"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                defaultValue={editingPost?.status ?? "draft"}
              >
                <option value="draft">draft</option>
                <option value="published">published</option>
                <option value="archived">archived</option>
              </select>
            </div>
            <SubmitButton className="w-fit" pendingLabel="Salvataggio post...">
              {editingPost ? "Aggiorna post" : "Crea post"}
            </SubmitButton>
            {firstParam(query.success) ? <p className="text-sm text-emerald-700">{firstParam(query.success)}</p> : null}
            {firstParam(query.error) ? <p className="text-sm text-destructive">{firstParam(query.error)}</p> : null}
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>Post esistenti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(posts ?? []).length === 0 ? (
            <p className="text-sm text-foreground/70">Nessun post creato.</p>
          ) : (
            (posts ?? []).map((post) => (
              <div key={post.id} className="rounded-2xl bg-secondary/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{post.title}</p>
                    <p className="text-sm text-foreground/65">{post.slug}</p>
                  </div>
                  <Badge variant="outline">{post.status}</Badge>
                </div>
                {post.published_at ? (
                  <p className="mt-2 text-sm text-foreground/70">{post.published_at}</p>
                ) : null}
                {post.cover_image_path ? (
                  <p className="mt-1 text-xs text-foreground/60">img: {post.cover_image_path}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link href={`/admin/posts?edit=${post.id}`} className="text-sm font-medium text-primary hover:underline">
                    Modifica
                  </Link>
                </div>
                <form action={deletePost} className="mt-3">
                  <input type="hidden" name="id" value={post.id} />
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
