import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAllProfilesForStaff,
  getNewsletterSubscribersForStaff,
  getProductRequestsForStaff,
  getPublishedEvents,
  getPublishedPosts,
} from "@/lib/gamestore/data";
import { requireUserWithRole } from "@/lib/gamestore/authz";

export default async function AdminDashboardPage() {
  const { supabase } = await requireUserWithRole("staff");
  const [events, posts, profiles, productRequests, subscribers] = await Promise.all([
    getPublishedEvents(supabase),
    getPublishedPosts(supabase),
    getAllProfilesForStaff(supabase),
    getProductRequestsForStaff(supabase),
    getNewsletterSubscribersForStaff(supabase),
  ]);

  const { count: draftEventsCount } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");

  const cards = [
    {
      title: "Eventi pubblicati",
      value: String(events.length),
      href: "/admin/events",
      hint: `${draftEventsCount ?? 0} bozza/e`,
    },
    {
      title: "Post pubblicati",
      value: String(posts.length),
      href: "/admin/posts",
      hint: "CMS news",
    },
    {
      title: "Profili registrati",
      value: String(profiles.length),
      href: "/admin/crm",
      hint: "CRM e note",
    },
    {
      title: "Richieste prodotto",
      value: String(productRequests.length),
      href: "/admin/product-requests",
      hint: "Tutti gli stati",
    },
    {
      title: "Iscritti newsletter",
      value: String(subscribers.length),
      href: "/admin/newsletter",
      hint: "Lista iscritti",
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Link key={card.title} href={card.href} className="block transition hover:opacity-95">
          <Card className="h-full border-border/70 bg-card/85 shadow-none hover:border-primary/40">
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <p className="text-xs font-normal text-foreground/55">{card.hint}</p>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-semibold">{card.value}</p>
              <p className="mt-2 text-sm text-primary">Apri sezione →</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </section>
  );
}
