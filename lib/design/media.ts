import heroManaNeroTradate from "@/images/hero-mana-nero-tradate.jpg";

export const siteMedia = {
  hero: heroManaNeroTradate.src,
  store:
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1400&q=80",
  newsletter:
    "https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&w=1200&q=80",
  events: [
    "https://images.unsplash.com/photo-1547700055-b61cacebece9?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=1200&q=80",
  ],
  news: [
    "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80",
  ],
  categories: {
    magic:
      "https://images.unsplash.com/photo-1633545495735-25df17a4fc95?auto=format&fit=crop&w=1200&q=80",
    pokemon:
      "https://images.unsplash.com/photo-1613771404721-1f92d799e49f?auto=format&fit=crop&w=1200&q=80",
    onePiece:
      "https://images.unsplash.com/photo-1606503153255-59d8b8b5b197?auto=format&fit=crop&w=1200&q=80",
    boardGames:
      "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=1200&q=80",
    miniatures:
      "https://images.unsplash.com/photo-1560179406-1c6c60e0dc76?auto=format&fit=crop&w=1200&q=80",
  },
} as const;

export function getEventImage(slug: string, index = 0) {
  if (slug.includes("magic")) return siteMedia.categories.magic;
  if (slug.includes("pokemon")) return siteMedia.categories.pokemon;
  if (slug.includes("one-piece")) return siteMedia.categories.onePiece;
  return siteMedia.events[index % siteMedia.events.length];
}

export function getNewsImage(slug: string, index = 0) {
  if (slug.includes("event")) return siteMedia.events[index % siteMedia.events.length];
  return siteMedia.news[index % siteMedia.news.length];
}

export function getCategoryImage(name: string) {
  const value = name.toLowerCase();
  if (value.includes("magic")) return siteMedia.categories.magic;
  if (value.includes("pokemon")) return siteMedia.categories.pokemon;
  if (value.includes("one piece")) return siteMedia.categories.onePiece;
  if (value.includes("board")) return siteMedia.categories.boardGames;
  return siteMedia.categories.miniatures;
}
