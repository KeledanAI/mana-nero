-- Game Store V1 — enums, tables, has_role, single booking RPC, RLS
-- Run via Supabase SQL editor or `supabase db push`

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('customer', 'staff', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.app_registration_action AS ENUM ('book', 'cancel', 'staff_check_in');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.event_status AS ENUM ('draft', 'published', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.registration_status AS ENUM ('confirmed', 'waitlisted', 'cancelled', 'checked_in');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.post_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.product_request_status AS ENUM ('new', 'in_review', 'fulfilled', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.outbox_channel AS ENUM ('email', 'telegram', 'whatsapp', 'internal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.outbox_status AS ENUM ('pending', 'processing', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Profiles (extend starter table if present)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  email text,
  full_name text,
  avatar_url text,
  role public.app_role NOT NULL DEFAULT 'customer',
  marketing_consent boolean NOT NULL DEFAULT false,
  newsletter_opt_in boolean NOT NULL DEFAULT false,
  interests text[] NOT NULL DEFAULT '{}'::text[],
  telegram_username text,
  whatsapp_e164 text
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'customer';
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS newsletter_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_username text;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_e164 text;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- ---------------------------------------------------------------------------
-- Event domain
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text
);

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  category_id uuid REFERENCES public.event_categories (id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  game_type text,
  status public.event_status NOT NULL DEFAULT 'draft',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  capacity integer NOT NULL CHECK (capacity > 0),
  price_display text,
  price_cents integer,
  currency text,
  deposit_cents integer
);

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status public.registration_status NOT NULL,
  waitlist_position integer,
  payment_intent_id text,
  payment_status text,
  UNIQUE NULLS NOT DISTINCT (event_id, user_id, status)
);

-- One active registration per user per event (confirmed OR waitlisted, not both)
CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_one_active_per_user_event
  ON public.event_registrations (event_id, user_id)
  WHERE status IN ('confirmed', 'waitlisted');

CREATE INDEX IF NOT EXISTS event_registrations_event_id_idx ON public.event_registrations (event_id);
CREATE INDEX IF NOT EXISTS event_registrations_user_id_idx ON public.event_registrations (user_id);

-- ---------------------------------------------------------------------------
-- Communication outbox (idempotent retries)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  channel public.outbox_channel NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.outbox_status NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT communication_outbox_idempotency_key_key UNIQUE (idempotency_key)
);

-- ---------------------------------------------------------------------------
-- CMS & CRM & products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  author_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  body text,
  status public.post_status NOT NULL DEFAULT 'draft',
  published_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL,
  opted_in boolean NOT NULL DEFAULT true,
  source text
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_lower_key
  ON public.newsletter_subscribers (lower(trim(email)));

CREATE TABLE IF NOT EXISTS public.admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  subject_profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.product_reservation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  product_name text NOT NULL,
  category text,
  notes text,
  status public.product_request_status NOT NULL DEFAULT 'new',
  quantity integer,
  desired_price numeric(12, 2),
  priority_flag boolean NOT NULL DEFAULT false
);

-- ---------------------------------------------------------------------------
-- Auth: ensure profile row exists
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- has_role(required) — used by all RLS policies
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(required public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE required
        WHEN 'admin' THEN p.role = 'admin'
        WHEN 'staff' THEN p.role IN ('staff', 'admin')
        WHEN 'customer' THEN p.role IN ('customer', 'staff', 'admin')
      END
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Single booking RPC — all registration mutations go through here
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_registration_action(
  p_operation public.app_registration_action,
  p_event_id uuid DEFAULT NULL,
  p_registration_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cap integer;
  v_evt_status public.event_status;
  v_confirmed integer;
  v_reg public.event_registrations%ROWTYPE;
  v_next_pos integer;
  v_promo_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_operation = 'book' THEN
    IF p_event_id IS NULL THEN
      RAISE EXCEPTION 'event_id_required';
    END IF;

    SELECT capacity, status INTO v_cap, v_evt_status
    FROM public.events
    WHERE id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'event_not_found';
    END IF;
    IF v_evt_status <> 'published' THEN
      RAISE EXCEPTION 'event_not_bookable';
    END IF;

    SELECT * INTO v_reg
    FROM public.event_registrations
    WHERE event_id = p_event_id
      AND user_id = v_uid
      AND status IN ('confirmed', 'waitlisted')
    FOR UPDATE;

    IF FOUND THEN
      RAISE EXCEPTION 'already_registered';
    END IF;

    SELECT count(*)::integer INTO v_confirmed
    FROM public.event_registrations
    WHERE event_id = p_event_id
      AND status = 'confirmed';

    IF v_confirmed < v_cap THEN
      INSERT INTO public.event_registrations (event_id, user_id, status, waitlist_position)
      VALUES (p_event_id, v_uid, 'confirmed', NULL);

      INSERT INTO public.communication_outbox (
        idempotency_key, channel, payload, status
      ) VALUES (
        'booking_confirm:' || p_event_id::text || ':' || v_uid::text,
        'email',
        jsonb_build_object(
          'kind', 'booking_confirmation',
          'event_id', p_event_id,
          'user_id', v_uid,
          'registration_status', 'confirmed'
        ),
        'pending'
      )
      ON CONFLICT (idempotency_key) DO NOTHING;

      RETURN jsonb_build_object('ok', true, 'status', 'confirmed');
    END IF;

    SELECT COALESCE(max(waitlist_position), 0) + 1 INTO v_next_pos
    FROM public.event_registrations
    WHERE event_id = p_event_id
      AND status = 'waitlisted';

    INSERT INTO public.event_registrations (event_id, user_id, status, waitlist_position)
    VALUES (p_event_id, v_uid, 'waitlisted', v_next_pos);

    INSERT INTO public.communication_outbox (
      idempotency_key, channel, payload, status
    ) VALUES (
      'booking_waitlist:' || p_event_id::text || ':' || v_uid::text,
      'email',
      jsonb_build_object(
        'kind', 'booking_waitlist',
        'event_id', p_event_id,
        'user_id', v_uid
      ),
      'pending'
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN jsonb_build_object('ok', true, 'status', 'waitlisted', 'position', v_next_pos);
  END IF;

  IF p_operation = 'cancel' THEN
    IF p_event_id IS NULL THEN
      RAISE EXCEPTION 'event_id_required';
    END IF;

    SELECT * INTO v_reg
    FROM public.event_registrations
    WHERE event_id = p_event_id
      AND user_id = v_uid
      AND status IN ('confirmed', 'waitlisted')
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'registration_not_found';
    END IF;

    UPDATE public.event_registrations
    SET status = 'cancelled',
        waitlist_position = NULL,
        updated_at = now()
    WHERE id = v_reg.id;

    IF v_reg.status = 'confirmed' THEN
      SELECT id INTO v_promo_id
      FROM public.event_registrations
      WHERE event_id = p_event_id
        AND status = 'waitlisted'
      ORDER BY waitlist_position ASC NULLS LAST, created_at ASC
      LIMIT 1
      FOR UPDATE;

      IF v_promo_id IS NOT NULL THEN
        UPDATE public.event_registrations
        SET status = 'confirmed',
            waitlist_position = NULL,
            updated_at = now()
        WHERE id = v_promo_id;

        WITH numbered AS (
          SELECT id,
                 row_number() OVER (
                   ORDER BY waitlist_position ASC NULLS LAST, created_at ASC
                 ) AS n
          FROM public.event_registrations
          WHERE event_id = p_event_id
            AND status = 'waitlisted'
        )
        UPDATE public.event_registrations er
        SET waitlist_position = numbered.n,
            updated_at = now()
        FROM numbered
        WHERE er.id = numbered.id;

        INSERT INTO public.communication_outbox (
          idempotency_key, channel, payload, status
        ) VALUES (
          'promoted_from_waitlist:' || p_event_id::text || ':' || v_promo_id::text,
          'email',
          jsonb_build_object(
            'kind', 'waitlist_promoted',
            'event_id', p_event_id,
            'user_id', (
              SELECT user_id FROM public.event_registrations WHERE id = v_promo_id
            )
          ),
          'pending'
        )
        ON CONFLICT (idempotency_key) DO NOTHING;
      END IF;
    END IF;

    RETURN jsonb_build_object('ok', true, 'status', 'cancelled');
  END IF;

  IF p_operation = 'staff_check_in' THEN
    IF NOT public.has_role('staff'::public.app_role) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    IF p_registration_id IS NULL THEN
      RAISE EXCEPTION 'registration_id_required';
    END IF;

    UPDATE public.event_registrations er
    SET status = 'checked_in',
        updated_at = now()
    WHERE er.id = p_registration_id
      AND er.status = 'confirmed'
    RETURNING * INTO v_reg;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'registration_not_checkin_ready';
    END IF;

    RETURN jsonb_build_object('ok', true, 'status', 'checked_in');
  END IF;

  RAISE EXCEPTION 'unsupported_operation';
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_role(public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_registration_action(
  public.app_registration_action, uuid, uuid
) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reservation_requests ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role('staff'));

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_staff_update ON public.profiles;
CREATE POLICY profiles_staff_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role('staff'))
  WITH CHECK (public.has_role('staff'));

-- Categories: public read
DROP POLICY IF EXISTS event_categories_public_read ON public.event_categories;
CREATE POLICY event_categories_public_read ON public.event_categories
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS event_categories_staff_write ON public.event_categories;
CREATE POLICY event_categories_staff_write ON public.event_categories
  FOR ALL TO authenticated
  USING (public.has_role('staff'))
  WITH CHECK (public.has_role('staff'));

-- Events: public read published
DROP POLICY IF EXISTS events_public_read ON public.events;
CREATE POLICY events_public_read ON public.events
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS events_staff_all ON public.events;
CREATE POLICY events_staff_all ON public.events
  FOR ALL TO authenticated
  USING (public.has_role('staff'))
  WITH CHECK (public.has_role('staff'));

-- Registrations: own read + staff read
DROP POLICY IF EXISTS er_select_own ON public.event_registrations;
CREATE POLICY er_select_own ON public.event_registrations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS er_select_staff ON public.event_registrations;
CREATE POLICY er_select_staff ON public.event_registrations
  FOR SELECT TO authenticated
  USING (public.has_role('staff'));

-- Outbox: staff read only
DROP POLICY IF EXISTS outbox_staff_select ON public.communication_outbox;
CREATE POLICY outbox_staff_select ON public.communication_outbox
  FOR SELECT TO authenticated
  USING (public.has_role('staff'));

-- Posts: public read published
DROP POLICY IF EXISTS posts_public_read ON public.posts;
CREATE POLICY posts_public_read ON public.posts
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND (published_at IS NULL OR published_at <= now()));

DROP POLICY IF EXISTS posts_staff_all ON public.posts;
CREATE POLICY posts_staff_all ON public.posts
  FOR ALL TO authenticated
  USING (public.has_role('staff'))
  WITH CHECK (public.has_role('staff'));

-- Newsletter
DROP POLICY IF EXISTS newsletter_insert_public ON public.newsletter_subscribers;
CREATE POLICY newsletter_insert_public ON public.newsletter_subscribers
  FOR INSERT TO anon, authenticated
  WITH CHECK (char_length(trim(email)) >= 3);

DROP POLICY IF EXISTS newsletter_staff_select ON public.newsletter_subscribers;
CREATE POLICY newsletter_staff_select ON public.newsletter_subscribers
  FOR SELECT TO authenticated
  USING (public.has_role('staff'));

-- Admin notes
DROP POLICY IF EXISTS admin_notes_staff_all ON public.admin_notes;
CREATE POLICY admin_notes_staff_all ON public.admin_notes
  FOR ALL TO authenticated
  USING (public.has_role('staff'))
  WITH CHECK (public.has_role('staff'));

-- Product requests
DROP POLICY IF EXISTS pr_insert_auth ON public.product_reservation_requests;
CREATE POLICY pr_insert_auth ON public.product_reservation_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS pr_select_own ON public.product_reservation_requests;
CREATE POLICY pr_select_own ON public.product_reservation_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS pr_staff_all ON public.product_reservation_requests;
CREATE POLICY pr_staff_all ON public.product_reservation_requests
  FOR ALL TO authenticated
  USING (public.has_role('staff'))
  WITH CHECK (public.has_role('staff'));
