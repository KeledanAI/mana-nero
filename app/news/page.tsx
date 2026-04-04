import { NewsCard } from "@/components/news-card";
import { PublicShell } from "@/components/public-shell";
import { SectionHeading } from "@/components/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getNewsImage } from "@/lib/design/media";
import { createClient } from "@/lib/supabase/server";
import { cmsStoragePublicUrl } from "@/lib/supabase/cms-storage";
import { formatDateTime, getPublishedPosts } from "@/lib/gamestore/data";

export default async function NewsPage() {
  const supabase = await createClient();
  const posts = await getPublishedPosts(supabase);

  return (
    <PublicShell>
      <main className="page-frame py-12">
        <SectionHeading
          eyebrow="Newsroom"
          title="Aggiornamenti con ritmo editoriale."
          description="Announcement, release note e comunicazioni di community con una presentazione visiva piu magazine che bacheca."
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {posts.length === 0 ? (
            <Card className="glass-panel lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-white">Nessun contenuto pubblicato</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-7 text-white/62">
                La sezione newsroom è pronta ma non contiene ancora post pubblicati.
              </CardContent>
            </Card>
          ) : null}

          {posts.map((post, index) => (
            <NewsCard
              key={post.id}
              imageUrl={cmsStoragePublicUrl(post.cover_image_path ?? "") ?? getNewsImage(post.slug, index)}
              title={post.title}
              description={post.body || "Apri il dettaglio per leggere il contenuto completo."}
              meta={post.published_at ? formatDateTime(post.published_at) : "News"}
              href={`/news/${post.slug}`}
            />
          ))}
        </div>
      </main>
    </PublicShell>
  );
}
