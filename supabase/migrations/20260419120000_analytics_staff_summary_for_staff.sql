-- Staff analytics: aggregati JSON con filtro opzionale su data creazione (iscrizioni / richieste / outbox pending).

CREATE OR REPLACE FUNCTION public.analytics_staff_summary(p_since timestamptz DEFAULT NULL)
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
    'events_published',
    (SELECT count(*)::bigint FROM public.events WHERE status = 'published'),
    'events_draft',
    (SELECT count(*)::bigint FROM public.events WHERE status = 'draft'),
    'events_cancelled',
    (SELECT count(*)::bigint FROM public.events WHERE status = 'cancelled'),
    'registrations_total',
    (
      SELECT count(*)::bigint
      FROM public.event_registrations er
      WHERE p_since IS NULL OR er.created_at >= p_since
    ),
    'registrations_confirmed',
    (
      SELECT count(*)::bigint
      FROM public.event_registrations er
      WHERE er.status = 'confirmed'
        AND (p_since IS NULL OR er.created_at >= p_since)
    ),
    'registrations_waitlisted',
    (
      SELECT count(*)::bigint
      FROM public.event_registrations er
      WHERE er.status = 'waitlisted'
        AND (p_since IS NULL OR er.created_at >= p_since)
    ),
    'registrations_cancelled',
    (
      SELECT count(*)::bigint
      FROM public.event_registrations er
      WHERE er.status = 'cancelled'
        AND (p_since IS NULL OR er.created_at >= p_since)
    ),
    'registrations_checked_in',
    (
      SELECT count(*)::bigint
      FROM public.event_registrations er
      WHERE er.status = 'checked_in'
        AND (p_since IS NULL OR er.created_at >= p_since)
    ),
    'registrations_pending_payment',
    (
      SELECT count(*)::bigint
      FROM public.event_registrations er
      WHERE er.status = 'pending_payment'
        AND (p_since IS NULL OR er.created_at >= p_since)
    ),
    'outbox_email_pending',
    (
      SELECT count(*)::bigint
      FROM public.communication_outbox ob
      WHERE ob.channel = 'email'::public.outbox_channel
        AND ob.status = 'pending'
        AND (p_since IS NULL OR ob.created_at >= p_since)
    ),
    'product_requests_total',
    (
      SELECT count(*)::bigint
      FROM public.product_reservation_requests pr
      WHERE p_since IS NULL OR pr.created_at >= p_since
    ),
    'product_awaiting_stock',
    (
      SELECT count(*)::bigint
      FROM public.product_reservation_requests pr
      WHERE pr.status = 'awaiting_stock'
        AND (p_since IS NULL OR pr.created_at >= p_since)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_staff_summary(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_staff_summary(timestamptz) TO service_role;
