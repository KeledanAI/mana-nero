import type { Metadata } from "next";

import { NewsCard } from "@/components/news-card";
import { PublicShell } from "@/components/public-shell";
import { SectionHeading } from "@/components/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { newsCardImageUrl } from "@/lib/design/media";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, getPublishedPosts } from "@/lib/gamestore/data";

export const metadata: Metadata = {
  title: "News",
  description:
    "Annunci, novità in negozio e aggiornamenti per la community del Mana Nero.",
  alternates: { canonical: "/news" },
};

export default async function NewsPage() {
  const supabase = await createClient();
  const posts = await getPublishedPosts(supabase);

  return (
    <PublicShell>
      <main className="page-frame py-12">
        <SectionHeading
          eyebrow="Newsroom"
          title="Aggiornamenti con ritmo editoriale."
          description="Annunci, note di release e aggiornamenti per la community, con una presentazione visiva più da magazine che da bacheca."
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
              imageUrl={newsCardImageUrl(post.cover_image_path, post.slug, index)}
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
