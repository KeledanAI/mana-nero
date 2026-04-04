-- Percorsi immagine nel bucket CMS per contenuti gestiti dal backoffice
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cover_image_path text;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS cover_image_path text;

ALTER TABLE public.event_categories
  ADD COLUMN IF NOT EXISTS cover_image_path text;
