INSERT INTO public.event_categories (name, slug, description)
VALUES
  ('Magic: The Gathering', 'magic-the-gathering', 'Eventi constructed, limited e commander.'),
  ('One Piece Card Game', 'one-piece-card-game', 'Tornei e community One Piece.'),
  ('Board Games', 'board-games', 'Serate demo e tavoli liberi.')
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO public.events (
  category_id,
  title,
  slug,
  description,
  game_type,
  status,
  starts_at,
  ends_at,
  capacity,
  price_display
)
SELECT
  c.id,
  seed.title,
  seed.slug,
  seed.description,
  seed.game_type,
  'published'::public.event_status,
  seed.starts_at,
  seed.ends_at,
  seed.capacity,
  seed.price_display
FROM (
  VALUES
    (
      'Friday Night Magic',
      'friday-night-magic',
      'Torneo settimanale con supporto waitlist e check-in staff.',
      'Modern',
      (now() + interval '7 days'),
      (now() + interval '7 days 4 hours'),
      32,
      '10 EUR'
    ),
    (
      'One Piece League',
      'one-piece-league',
      'Tappa community per giocatori abituali e nuovi ingressi.',
      'Constructed',
      (now() + interval '10 days'),
      (now() + interval '10 days 4 hours'),
      24,
      '8 EUR'
    )
) AS seed(title, slug, description, game_type, starts_at, ends_at, capacity, price_display)
JOIN public.event_categories c
  ON c.slug = CASE seed.slug
    WHEN 'friday-night-magic' THEN 'magic-the-gathering'
    ELSE 'one-piece-card-game'
  END
ON CONFLICT (slug) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  game_type = EXCLUDED.game_type,
  status = EXCLUDED.status,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  capacity = EXCLUDED.capacity,
  price_display = EXCLUDED.price_display,
  category_id = EXCLUDED.category_id,
  updated_at = now();
