-- Pagine "gioco" pubbliche gestite da admin (home tematiche Magic, One Piece, D&D, Riftbound, FAB)

CREATE TABLE IF NOT EXISTS public.game_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  eyebrow text,
  hero_title text NOT NULL,
  intro text,
  body text,
  hero_image_path text,
  status public.post_status NOT NULL DEFAULT 'draft',
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS game_pages_status_sort_idx
  ON public.game_pages (status, sort_order);

ALTER TABLE public.game_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_pages_public_read ON public.game_pages;
CREATE POLICY game_pages_public_read ON public.game_pages
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS game_pages_staff_all ON public.game_pages;
CREATE POLICY game_pages_staff_all ON public.game_pages
  FOR ALL TO authenticated
  USING (public.has_role('staff'))
  WITH CHECK (public.has_role('staff'));

INSERT INTO public.game_pages (
  slug, display_name, eyebrow, hero_title, intro, body, hero_image_path, status, sort_order
) VALUES
(
  'magic-the-gathering',
  'Magic: The Gathering',
  'TCG · Commander, Draft e Tornei',
  'Il Multiverso al Mana Nero: Commander serale, league e draft dopo chiusura.',
  $$Tavoli dedicati a Commander pod, eventi Constructed e draft when-shop con prize support (testo di esempio). Staff italiano, regolamenti Wizards di riferimento e calendario allineato agli store championship quando disponibili.$$,
  $$FORMATI DI ESEMPIO
• Commander casual & competitive pod — serata fissa e tabellone ranking locale.
• Draft e Sealed — eventi promossi sulla pagina Eventi.
• Standard/Pioneer — league in blocchi da 4 settimane (copy dimostrativo).

INFO NEGOZIO
Accessori, sleeves e binder a catalogo; preordini set prossimi (esempio). Prenota il posto per FNM e serate prerelease dal sito.$$,
  '/images/game-pages/magic-the-gathering-hero.jpg',
  'published',
  1
),
(
  'one-piece',
  'One Piece Card Game',
  'TCG · Straw Hat e nuove mete',
  'Cappello di paglia in tavolo: league OP e serate per costruttori.',
  $$Ambiente dedicato al gioco di carte One Piece Card Game ufficiale: match best-of-3, mazzi Leader meta e friendly per chi inizia con starter deck (testo dimostrativo).$$,
  $$PROGRAMMA ESEMPIO
• League mensile con gironi e playoff top cut (mock).
• Learn-to-play con deck forniti dal negozio su richiesta.
• Side event durante giornate TCG affollate.

NOTA: premi e date pubblicati nella sezione Eventi quando confermati.$$,
  '/images/game-pages/one-piece-hero.jpg',
  'published',
  2
),
(
  'dungeons-and-dragons',
  'Dungeons & Dragons',
  'RPG · Tavoli narrativi',
  'Sessioni D&D in negozio: one-shot, campagne corta e session zero guidata.',
  $$Spazio per party da 3-5 avventurieri, mappe, schermi e musica ambient — ideale come hub per gruppi che cercano un master o giocatori (esempio).$$,
  $$COME FUNZIONA (ESEMPIO)
• One-shot serali 3h con personaggi pre-generati oppure level 1 portati da te.
• Campagna "12 sedute" con calendario condiviso in chat negozio (placeholder).
• Session zero gratuita per nuovi giocatori su prenotazione.

MATERIALE: manuali consultabili in zona relax; dadi in vendita. Non serve possedere tutti i libri per le serate introduttive.$$,
  '/images/game-pages/dungeons-and-dragons-hero.jpg',
  'published',
  3
),
(
  'riftbound',
  'Riftbound',
  'TCG · League of Legends universe',
  'Campi di battaglia Runeterra: sealed, constructed e serate multigiocatore.',
  $$Riftbound è il trading card game strategico ambientato nell'universo di League of Legends: mazzi costruiti intorno ai campioni, domini che mixano sinergie e match 1v1 o formati a squadre (copy di esempio ispirato al prodotto commerciale).$$,
  $$IN NEGOZIO (TESTO DIMOSTRATIVO)
• Tornei sealed all'uscita dei set; poi constructed con ban list ufficiale.
• Tavoli free-for-all fino a 4 giocatori quando il regolamento lo consente.
• League con punti mensili e premiazioni TCG (mock).

Aggiorniamo formati in base a linee guida editor e community — vedi Eventi per date.$$,
  '/images/game-pages/riftbound-hero.jpg',
  'published',
  4
),
(
  'flesh-and-blood',
  'Flesh and Blood',
  'TCG · Classic Constructed & Blitz',
  'Arsenal, deck tech e Armory Night al Mana Nero.',
  $$Linee aggressive e defensive: Blitz serale e Classic Constructed con riferimento alle floor rules LSS (esempio). Spazio per testing pre-torneo; policy proxy solo dove consentito dagli Organized Play ufficiali.$$,
  $$LINEA FAB (ESEMPIO)
• Armory settimanali — entry amichevole e premiazioni casual round (mock).
• Road to Nationals: aggancio ai qualifier regionali quando comunicati.
• Blitz per serate corte post-lavoro.

Deck list prima del check-in per abbinamenti rapidi. Chiedi allo staff per playmat e carta regole.$$,
  '/images/game-pages/flesh-and-blood-hero.jpg',
  'published',
  5
)
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  eyebrow = EXCLUDED.eyebrow,
  hero_title = EXCLUDED.hero_title,
  intro = EXCLUDED.intro,
  body = EXCLUDED.body,
  hero_image_path = EXCLUDED.hero_image_path,
  status = EXCLUDED.status,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
