-- Pagine silo Pokémon TCG e giochi da tavolo (hub /giochi)

INSERT INTO public.game_pages (
  slug, display_name, eyebrow, hero_title, intro, body, hero_image_path, status, sort_order
) VALUES
(
  'pokemon-tcg',
  'Pokémon GCC',
  'TCG · League e serate in negozio',
  'Carte, mazzi e Leghe: il tuo laboratorio Pokémon al Mana Nero.',
  $$Ambiente family friendly e tavoli per Competitive e Casual: dai mazzi in meta alle partite con starter (testo di esempio). Staff per regolamenti ufficiali Pokémon e spazio testing prima dei tornei.$$,
  $$IN NEGOZIO (ESEMPIO)
• League con gironi mensili e premiazioni (date su Eventi).
• Learn-to-play con deck dimostrativi su richiesta.
• Spazio sleeve, binder e accessori a catalogo.

I dettagli su date, formati e iscrizioni sono nella sezione Eventi.$$,
  '/images/game-pages/pokemon-tcg-hero.jpg',
  'published',
  6
),
(
  'board-games',
  'Giochi da tavolo',
  'Social · Demo e serate',
  'Tavoli aperti, novità in anteprima e gruppi che vogliono solo divertirsi.',
  $$Dalla filler alla strategia leggera: serate demo, club fissi e proposte del mese. Lo staff consiglia titoli in base al gruppo e al tempo disponibile (testo dimostrativo).$$,
  $$COME FUNZIONA (ESEMPIO)
• Demo night con 2–3 titoli in rotazione; posti limitati.
• Tavoli “porta il tuo gioco” in fasce orarie concordate.
• Serate rapide (under 60 min) e serate long (2h+).

Prenotazioni e calendario nella pagina Eventi.$$,
  '/images/game-pages/board-games-hero.jpg',
  'published',
  7
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
