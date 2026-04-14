-- CRM Fase 1: audit staff; QR finestra più stretta + slug in risposta + rotazione token staff; tabella comms_campaigns (stub).

-- ---------------------------------------------------------------------------
-- Audit CRM (solo staff; insert con actor = sessione)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_crm_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_crm_audit_log_created_at_idx
  ON public.staff_crm_audit_log (created_at DESC);

ALTER TABLE public.staff_crm_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_crm_audit_log_select ON public.staff_crm_audit_log;
CREATE POLICY staff_crm_audit_log_select ON public.staff_crm_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role('staff'::public.app_role));

DROP POLICY IF EXISTS staff_crm_audit_log_insert ON public.staff_crm_audit_log;
CREATE POLICY staff_crm_audit_log_insert ON public.staff_crm_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = actor_id
    AND public.has_role('staff'::public.app_role)
  );

GRANT SELECT, INSERT ON public.staff_crm_audit_log TO authenticated;
GRANT ALL ON public.staff_crm_audit_log TO service_role;

COMMENT ON TABLE public.staff_crm_audit_log IS
  'Traccia azioni staff rilevanti per CRM (Fase 1 epic); estendibile a export e accessi sensibili.';

-- ---------------------------------------------------------------------------
-- Campagne: tabella dedicata (stub; UI enqueue può popolare in iterazioni successive)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comms_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL DEFAULT '',
  segment_kind text NOT NULL CHECK (segment_kind IN ('newsletter_opt_in', 'marketing_consent')),
  subject_line text,
  teaser text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comms_campaigns_slug_key UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS comms_campaigns_created_at_idx ON public.comms_campaigns (created_at DESC);

ALTER TABLE public.comms_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comms_campaigns_staff_all ON public.comms_campaigns;
CREATE POLICY comms_campaigns_staff_all ON public.comms_campaigns
  FOR ALL TO authenticated
  USING (public.has_role('staff'::public.app_role))
  WITH CHECK (public.has_role('staff'::public.app_role));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comms_campaigns TO authenticated;
GRANT ALL ON public.comms_campaigns TO service_role;

COMMENT ON TABLE public.comms_campaigns IS
  'Metadati campagne staff (estensione design v2 comms); collegamento a outbox da implementare in UI.';

-- ---------------------------------------------------------------------------
-- QR: finestra check-in (max 8 giorni prima, fino a 72 ore dopo inizio) + slug in risposta
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_check_in_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg public.event_registrations%ROWTYPE;
  v_starts timestamptz;
  v_evt_status public.event_status;
  v_slug text;
BEGIN
  IF p_token IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT er.* INTO v_reg
  FROM public.event_registrations er
  WHERE er.check_in_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_not_found');
  END IF;

  IF v_reg.status <> 'confirmed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_checkin_ready', 'status', v_reg.status);
  END IF;

  SELECT e.starts_at, e.status, e.slug INTO v_starts, v_evt_status, v_slug
  FROM public.events e
  WHERE e.id = v_reg.event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_not_found');
  END IF;

  IF v_evt_status <> 'published' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_not_published');
  END IF;

  IF v_starts > now() + interval '8 days' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_early');
  END IF;

  IF v_starts < now() - interval '72 hours' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_late');
  END IF;

  UPDATE public.event_registrations
  SET status = 'checked_in',
      check_in_token = NULL,
      updated_at = now()
  WHERE id = v_reg.id
    AND status = 'confirmed';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'concurrent_change');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'checked_in',
    'event_id', v_reg.event_id,
    'event_slug', coalesce(v_slug, '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.event_check_in_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_check_in_by_token(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- QR: rotazione token (solo staff, iscrizione confermata)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_rotate_registration_check_in_token(p_registration_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_new uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.has_role('staff'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_registration_id IS NULL THEN
    RAISE EXCEPTION 'registration_id_required';
  END IF;

  UPDATE public.event_registrations er
  SET check_in_token = gen_random_uuid(),
      updated_at = now()
  WHERE er.id = p_registration_id
    AND er.status = 'confirmed'
  RETURNING check_in_token INTO v_new;

  IF v_new IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_rotatable');
  END IF;

  RETURN jsonb_build_object('ok', true, 'check_in_token', v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_rotate_registration_check_in_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_rotate_registration_check_in_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_rotate_registration_check_in_token(uuid) TO service_role;
