import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";

import { PublicShell } from "@/components/public-shell";
import { newsCardImageUrl } from "@/lib/design/media";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, getPostBySlug } from "@/lib/gamestore/data";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const post = await getPostBySlug(supabase, slug);
  if (!post) return { title: "News" };

  const description =
    post.body?.replace(/\s+/g, " ").trim().slice(0, 155) || post.title;

  return {
    title: post.title,
    description,
    alternates: { canonical: `/news/${slug}` },
  };
}

export default async function NewsDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const post = await getPostBySlug(supabase, slug);

  if (!post) notFound();

  const heroUrl = newsCardImageUrl(post.cover_image_path, post.slug, 0);

  return (
    <PublicShell>
      <main>
        <div
          className="relative w-full overflow-hidden border-b border-white/10"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(8,10,21,0.5) 0%, rgba(8,10,21,0.95) 100%), url(${heroUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="page-frame py-16 sm:py-20 lg:py-24">
            <Breadcrumb
              items={[
                { label: "Home", href: "/" },
                { label: "News", href: "/news" },
                { label: post.title },
              ]}
              className="mb-6"
            />
            <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/80">
              {post.published_at ? formatDateTime(post.published_at) : "News"}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              {post.title}
            </h1>
          </div>
        </div>

        <article className="page-frame py-12">
          <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 sm:p-10">
            <div className="prose prose-invert max-w-none whitespace-pre-wrap text-base leading-8 text-white/80">
              {post.body || "Contenuto non disponibile."}
            </div>
          </div>
        </article>
      </main>
    </PublicShell>
  );
}
