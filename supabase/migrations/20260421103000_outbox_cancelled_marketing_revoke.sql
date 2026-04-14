-- Outbox: stato cancelled + RPC staff per annullare campagne marketing pending dopo revoca consenso (Q2 / sprint S2).

ALTER TYPE public.outbox_status ADD VALUE IF NOT EXISTS 'cancelled';

CREATE OR REPLACE FUNCTION public.staff_cancel_pending_marketing_campaign_outbox(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_profile');
  END IF;

  IF NOT public.has_role('staff'::public.app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  UPDATE public.communication_outbox ob
  SET
    status = 'cancelled'::public.outbox_status,
    last_error = 'marketing_consent_revoked',
    updated_at = now()
  WHERE ob.status = 'pending'::public.outbox_status
    AND ob.channel = 'email'::public.outbox_channel
    AND coalesce(ob.payload ->> 'kind', '') = 'campaign_segment'
    AND ob.payload ->> 'segment_kind' = 'marketing_consent'
    AND nullif(trim(ob.payload ->> 'user_id'), '') IS NOT NULL
    AND (ob.payload ->> 'user_id')::uuid = p_profile_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'cancelled', n);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_cancel_pending_marketing_campaign_outbox(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_cancel_pending_marketing_campaign_outbox(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_cancel_pending_marketing_campaign_outbox(uuid) TO service_role;
