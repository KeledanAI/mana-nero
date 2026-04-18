-- Community OS — slice 1
--
-- Scope: rende lo store indipendente da piattaforme proprietarie (Wizards EventLink,
-- Bandai TCG+, Play! Pokémon, WBO, Spicerack) introducendo:
--   1. `player_external_identities`: ogni profilo può collegare i propri account
--      sulle piattaforme ufficiali (DCI, BNID, Play! Pokémon ID, WBO username,
--      Discord, Telegram). I dati restano di proprietà dello store, abilitando
--      promozione e ranking locale anche se le API ufficiali sono chiuse.
--   2. `tournament_results`: lo staff registra esiti dei tornei interni
--      (rank finale, win/loss/draw, punteggio normalizzato) collegandoli al
--      profilo se presente, oppure salvando un walk-in solo con display_name.
--   3. `public.local_player_ranking(p_game_slug, p_limit)`: SECURITY DEFINER
--      function che espone in modo pubblico la classifica aggregata per categoria
--      di gioco senza esporre PII raw delle row di tournament_results.
--
-- Le tabelle sono additive: nessun cambio a `events`, `event_registrations`,
-- `profiles` o RPC `event_registration_action`. Il booking flow resta intatto.

-- ---------------------------------------------------------------------------
-- player_external_identities — collega profili a piattaforme esterne
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_external_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  platform text NOT NULL,
  external_id text NOT NULL DEFAULT '',
  external_username text,
  verified boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_external_identities_platform_check CHECK (
    platform IN (
      'wizards_companion',
      'bandai_tcg_plus',
      'play_pokemon',
      'world_beyblade_organization',
      'spicerack',
      'melee_gg',
      'discord',
      'telegram',
      'twitch',
      'instagram'
    )
  ),
  CONSTRAINT player_external_identities_profile_platform_unique
    UNIQUE (profile_id, platform)
);

CREATE INDEX IF NOT EXISTS player_external_identities_profile_idx
  ON public.player_external_identities (profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS player_external_identities_platform_external_idx
  ON public.player_external_identities (platform, external_id)
  WHERE external_id <> '';

ALTER TABLE public.player_external_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_external_identities_select ON public.player_external_identities;
CREATE POLICY player_external_identities_select ON public.player_external_identities
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.has_role('staff'::public.app_role)
  );

DROP POLICY IF EXISTS player_external_identities_owner_insert ON public.player_external_identities;
CREATE POLICY player_external_identities_owner_insert ON public.player_external_identities
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS player_external_identities_owner_update ON public.player_external_identities;
CREATE POLICY player_external_identities_owner_update ON public.player_external_identities
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS player_external_identities_owner_delete ON public.player_external_identities;
CREATE POLICY player_external_identities_owner_delete ON public.player_external_identities
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS player_external_identities_staff_all ON public.player_external_identities;
CREATE POLICY player_external_identities_staff_all ON public.player_external_identities
  FOR ALL TO authenticated
  USING (public.has_role('staff'::public.app_role))
  WITH CHECK (public.has_role('staff'::public.app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_external_identities TO authenticated;
GRANT ALL ON public.player_external_identities TO service_role;

COMMENT ON TABLE public.player_external_identities IS
  'Collega un profilo Mana Nero a un account su piattaforme esterne (DCI, BNID, WBO, ecc.). Lo staff può marcare l''identità come verificata.';

-- Mantieni `verified` non modificabile dall''utente: solo staff può cambiarlo.
CREATE OR REPLACE FUNCTION public.player_external_identities_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();

  IF TG_OP = 'INSERT' THEN
    IF NEW.verified IS TRUE
       AND NOT public.has_role('staff'::public.app_role) THEN
      NEW.verified := false;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.profile_id <> OLD.profile_id
       AND NOT public.has_role('staff'::public.app_role) THEN
      NEW.profile_id := OLD.profile_id;
    END IF;
    IF NEW.verified IS DISTINCT FROM OLD.verified
       AND NOT public.has_role('staff'::public.app_role) THEN
      NEW.verified := OLD.verified;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS player_external_identities_guard_trg
  ON public.player_external_identities;
CREATE TRIGGER player_external_identities_guard_trg
  BEFORE INSERT OR UPDATE ON public.player_external_identities
  FOR EACH ROW EXECUTE FUNCTION public.player_external_identities_guard();

-- ---------------------------------------------------------------------------
-- tournament_results — risultati interni registrati dallo staff
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  display_name text NOT NULL,
  external_handle text,
  format text,
  final_rank integer NOT NULL CHECK (final_rank >= 1),
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses integer NOT NULL DEFAULT 0 CHECK (losses >= 0),
  draws integer NOT NULL DEFAULT 0 CHECK (draws >= 0),
  points numeric(10, 2) NOT NULL DEFAULT 0 CHECK (points >= 0),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tournament_results_display_name_check CHECK (length(btrim(display_name)) > 0)
);

CREATE INDEX IF NOT EXISTS tournament_results_event_idx
  ON public.tournament_results (event_id, final_rank);
CREATE INDEX IF NOT EXISTS tournament_results_profile_idx
  ON public.tournament_results (profile_id)
  WHERE profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tournament_results_event_profile_unique_idx
  ON public.tournament_results (event_id, profile_id)
  WHERE profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tournament_results_event_walkin_unique_idx
  ON public.tournament_results (event_id, lower(btrim(display_name)))
  WHERE profile_id IS NULL;

CREATE OR REPLACE FUNCTION public.tournament_results_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tournament_results_touch_updated_at_trg
  ON public.tournament_results;
CREATE TRIGGER tournament_results_touch_updated_at_trg
  BEFORE UPDATE ON public.tournament_results
  FOR EACH ROW EXECUTE FUNCTION public.tournament_results_touch_updated_at();

ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tournament_results_owner_select ON public.tournament_results;
CREATE POLICY tournament_results_owner_select ON public.tournament_results
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.has_role('staff'::public.app_role)
  );

DROP POLICY IF EXISTS tournament_results_staff_all ON public.tournament_results;
CREATE POLICY tournament_results_staff_all ON public.tournament_results
  FOR ALL TO authenticated
  USING (public.has_role('staff'::public.app_role))
  WITH CHECK (public.has_role('staff'::public.app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_results TO authenticated;
GRANT ALL ON public.tournament_results TO service_role;

COMMENT ON TABLE public.tournament_results IS
  'Risultati di tornei interni: registrati dallo staff, alimentano la classifica locale per categoria di gioco. Walk-in supportati con profile_id NULL.';

-- ---------------------------------------------------------------------------
-- public.local_player_ranking — classifica aggregata pubblica via SECURITY DEFINER
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.local_player_ranking(
  p_game_slug text,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  player_key text,
  display_name text,
  profile_id uuid,
  events_played bigint,
  total_points numeric,
  best_finish integer,
  last_event_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      tr.id,
      tr.profile_id,
      tr.display_name,
      tr.points,
      tr.final_rank,
      e.starts_at,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(tr.profile_id::text, 'walkin:' || lower(btrim(tr.display_name)))
        ORDER BY e.starts_at DESC, tr.created_at DESC
      ) AS recency_rank,
      COALESCE(tr.profile_id::text, 'walkin:' || lower(btrim(tr.display_name))) AS player_key
    FROM public.tournament_results tr
    JOIN public.events e ON e.id = tr.event_id
    JOIN public.event_categories ec ON ec.id = e.category_id
    WHERE ec.slug = p_game_slug
      AND e.status = 'published'::public.event_status
  ), latest_name AS (
    SELECT player_key, display_name, profile_id
    FROM base
    WHERE recency_rank = 1
  )
  SELECT
    base.player_key,
    latest_name.display_name,
    latest_name.profile_id,
    COUNT(*)::bigint AS events_played,
    COALESCE(SUM(base.points), 0)::numeric AS total_points,
    MIN(base.final_rank)::integer AS best_finish,
    MAX(base.starts_at) AS last_event_at
  FROM base
  JOIN latest_name USING (player_key)
  GROUP BY base.player_key, latest_name.display_name, latest_name.profile_id
  ORDER BY total_points DESC, best_finish ASC, last_event_at DESC NULLS LAST
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 50), 200), 1);
$$;

REVOKE ALL ON FUNCTION public.local_player_ranking(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.local_player_ranking(text, integer) TO anon, authenticated;

COMMENT ON FUNCTION public.local_player_ranking(text, integer) IS
  'Classifica pubblica per categoria di gioco aggregata da tournament_results. SECURITY DEFINER per esporre solo le aggregazioni e non le row PII.';

-- ---------------------------------------------------------------------------
-- public.local_ranking_summary_for_game — quick KPI per pagine /giochi/[slug]
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.local_ranking_summary(p_game_slug text)
RETURNS TABLE (
  total_players bigint,
  total_results bigint,
  last_event_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(DISTINCT COALESCE(tr.profile_id::text, 'walkin:' || lower(btrim(tr.display_name))))::bigint AS total_players,
    COUNT(*)::bigint AS total_results,
    MAX(e.starts_at) AS last_event_at
  FROM public.tournament_results tr
  JOIN public.events e ON e.id = tr.event_id
  JOIN public.event_categories ec ON ec.id = e.category_id
  WHERE ec.slug = p_game_slug
    AND e.status = 'published'::public.event_status;
$$;

REVOKE ALL ON FUNCTION public.local_ranking_summary(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.local_ranking_summary(text) TO anon, authenticated;

COMMENT ON FUNCTION public.local_ranking_summary(text) IS
  'KPI sintetici (n. giocatori, n. risultati, ultimo evento) per la classifica locale di una categoria.';
