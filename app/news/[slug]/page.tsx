import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "News", href: "/news" },
          { label: post.title },
        ]}
        className="mb-6"
      />
      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">
            {post.published_at ? formatDateTime(post.published_at) : "News"}
          </p>
          <CardTitle className="text-4xl">{post.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-base leading-8 text-foreground/75">
          {post.body || "Contenuto non disponibile."}
        </CardContent>
      </Card>
    </main>
  );
}
