import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { gamePageHeroUrl } from "@/lib/design/media";
import { getPublishedGamePageBySlug } from "@/lib/gamestore/data";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const page = await getPublishedGamePageBySlug(supabase, slug);
  if (!page) return { title: "Gioco" };

  const description =
    page.intro?.replace(/\s+/g, " ").trim().slice(0, 155) || page.hero_title;

  return {
    title: page.display_name,
    description,
  };
}

export default async function GamePageDetail({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const page = await getPublishedGamePageBySlug(supabase, slug);

  if (!page) notFound();

  const heroUrl = gamePageHeroUrl(page.hero_image_path);

  return (
    <PublicShell>
      <main>
        <div className="relative w-full overflow-hidden border-b border-white/10">
          <div className="relative h-[min(52vh,580px)] w-full min-h-[200px] sm:h-[min(48vh,640px)]">
            <img
              src={heroUrl}
              alt={page.display_name}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </div>
        </div>

        <div className="page-frame pb-12 pt-4 sm:pb-14 sm:pt-5">
          <header className="max-w-3xl border-b border-white/10 pb-8 sm:pb-10">
            <nav className="mb-3 text-sm text-white/55">
              <Link href="/" className="transition hover:text-white">
                Home
              </Link>
              <span className="mx-2 text-white/35">/</span>
              <Link href="/giochi" className="transition hover:text-white">
                Giochi
              </Link>
              <span className="mx-2 text-white/35">/</span>
              <span className="text-white">{page.display_name}</span>
            </nav>
            {page.eyebrow ? (
              <p className="text-[11px] uppercase tracking-[0.32em] text-amber-300">{page.eyebrow}</p>
            ) : null}
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              {page.hero_title}
            </h1>
            {page.intro ? (
              <p className="mt-6 max-w-2xl whitespace-pre-wrap text-base leading-relaxed text-white/80 sm:text-lg">
                {page.intro}
              </p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-sm">
                <Link href="/events">Eventi in programma</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-white/25 bg-white/5 px-7 text-sm text-white hover:bg-white/12 hover:text-white"
              >
                <Link href="/contact">Contatta lo staff</Link>
              </Button>
            </div>
          </header>

          {page.body ? (
            <section className="mt-10 max-w-3xl sm:mt-12">
              <h2 className="text-lg font-semibold text-white">Dettagli</h2>
              <div className="mt-4 whitespace-pre-wrap text-base leading-8 text-white/75">{page.body}</div>
            </section>
          ) : null}
        </div>
      </main>
    </PublicShell>
  );
}
