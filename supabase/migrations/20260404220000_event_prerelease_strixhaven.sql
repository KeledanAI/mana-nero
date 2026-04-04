-- Prerelease Strixhaven @ Mana Nero (Tradate)
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
  'Prerelease Strixhaven: School of Mages — la Scuola dei Maghi riapre',
  'prerelease-strixhaven-tradate-2026-04-17',
  $body$
Torniamo tra i banchi della più grande accademia di magia del Multiverso: prerelease di Strixhaven — School of Mages!

Gioca con il tuo kit sealed, scopri le meccaniche dell'espansione e incontra la community del Mana Nero. Posti limitati: prenota il tuo posto in anticipo.

Dove siamo
Via Alessandro Volta 16, Tradate

Premi
Ogni vittoria garantisce una busta bonus di Strixhaven.

Info utili
• Posti disponibili: 30
• Quota di partecipazione: 35 €
$body$,
  'Prerelease (Sealed)',
  'published'::public.event_status,
  TIMESTAMPTZ '2026-04-17 19:00:00+02',
  TIMESTAMPTZ '2026-04-17 23:00:00+02',
  30,
  '35 €'
FROM public.event_categories c
WHERE c.slug = 'magic-the-gathering'
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
