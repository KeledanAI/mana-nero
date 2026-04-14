-- QR: finestra check-in configurabile per evento; risposta RPC arricchita per UX calendario.
-- Analytics: outbox campagne segmentate per status; riepilogo iscrizioni waitlist/funnel.
-- Profili: lookahead opzionale per notifiche stock (override per cliente).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS check_in_early_days integer,
  ADD COLUMN IF NOT EXISTS check_in_late_hours integer;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_check_in_early_days_range;
ALTER TABLE public.events
  ADD CONSTRAINT events_check_in_early_days_range
  CHECK (check_in_early_days IS NULL OR (check_in_early_days >= 0 AND check_in_early_days <= 60));

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_check_in_late_hours_range;
ALTER TABLE public.events
  ADD CONSTRAINT events_check_in_late_hours_range
  CHECK (check_in_late_hours IS NULL OR (check_in_late_hours >= 1 AND check_in_late_hours <= 336));

COMMENT ON COLUMN public.events.check_in_early_days IS
  'Giorni max prima dell''inizio in cui il check-in self-serve è consentito (null = default 8).';
COMMENT ON COLUMN public.events.check_in_late_hours IS
  'Ore max dopo l''inizio in cui il check-in self-serve è consentito (null = default 72).';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stock_notification_lookahead_days integer;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_stock_notification_lookahead_days_range;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_stock_notification_lookahead_days_range
  CHECK (
    stock_notification_lookahead_days IS NULL
    OR (stock_notification_lookahead_days >= 1 AND stock_notification_lookahead_days <= 730)
  );

COMMENT ON COLUMN public.profiles.stock_notification_lookahead_days IS
  'Override giorni lookahead per email arrivo merce (null = usa solo env globale PRODUCT_STOCK_EXPECTED_LOOKAHEAD_DAYS).';

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
  v_title text;
  v_early integer;
  v_late integer;
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

  SELECT e.starts_at, e.status, e.slug, e.title, e.check_in_early_days, e.check_in_late_hours
  INTO v_starts, v_evt_status, v_slug, v_title, v_early, v_late
  FROM public.events e
  WHERE e.id = v_reg.event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_not_found');
  END IF;

  IF v_evt_status <> 'published' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_not_published');
  END IF;

  v_early := coalesce(v_early, 8);
  v_late := coalesce(v_late, 72);

  IF v_starts > now() + make_interval(days => v_early) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_early');
  END IF;

  IF v_starts < now() - make_interval(hours => v_late) THEN
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
    'event_slug', coalesce(v_slug, ''),
    'event_title', coalesce(v_title, ''),
    'event_starts_at', v_starts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.event_check_in_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_check_in_by_token(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.analytics_outbox_campaign_segment_stats()
RETURNS TABLE (status text, n bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role('staff'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    ob.status::text AS status,
    count(*)::bigint AS n
  FROM public.communication_outbox ob
  WHERE ob.channel = 'email'::public.outbox_channel
    AND coalesce(ob.payload ->> 'kind', '') = 'campaign_segment'
  GROUP BY ob.status
  ORDER BY n DESC, status ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_outbox_campaign_segment_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_outbox_campaign_segment_stats() TO service_role;

CREATE OR REPLACE FUNCTION public.analytics_waitlist_registration_summary(p_since timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role('staff'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN jsonb_build_object(
    'waitlisted',
    (
      SELECT count(*)::bigint
      FROM public.event_registrations er
      WHERE er.status = 'waitlisted'
        AND (p_since IS NULL OR er.created_at >= p_since)
    ),
    'confirmed',
    (
      SELECT count(*)::bigint
      FROM public.event_registrations er
      WHERE er.status = 'confirmed'
        AND (p_since IS NULL OR er.created_at >= p_since)
    ),
    'checked_in',
    (
      SELECT count(*)::bigint
      FROM public.event_registrations er
      WHERE er.status = 'checked_in'
        AND (p_since IS NULL OR er.created_at >= p_since)
    ),
    'cancelled',
    (
      SELECT count(*)::bigint
      FROM public.event_registrations er
      WHERE er.status = 'cancelled'
        AND (p_since IS NULL OR er.created_at >= p_since)
    ),
    'pending_payment',
    (
      SELECT count(*)::bigint
      FROM public.event_registrations er
      WHERE er.status = 'pending_payment'
        AND (p_since IS NULL OR er.created_at >= p_since)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_waitlist_registration_summary(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_waitlist_registration_summary(timestamptz) TO service_role;
