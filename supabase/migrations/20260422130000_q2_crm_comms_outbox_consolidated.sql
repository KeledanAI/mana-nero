-- Q2: annullamento outbox campagna per segmento (marketing + newsletter); campi CRM contatto; segmento waitlist in comms_campaigns.

-- ---------------------------------------------------------------------------
-- Outbox: RPC interna + wrapper newsletter; marketing delega all'interna.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_cancel_pending_campaign_segment_outbox(
  p_profile_id uuid,
  p_segment_kind text
)
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

  IF p_segment_kind IS NULL OR p_segment_kind NOT IN ('marketing_consent', 'newsletter_opt_in') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_segment');
  END IF;

  IF NOT public.has_role('staff'::public.app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  UPDATE public.communication_outbox ob
  SET
    status = 'cancelled'::public.outbox_status,
    last_error = CASE p_segment_kind
      WHEN 'marketing_consent' THEN 'marketing_consent_revoked'
      ELSE 'newsletter_opt_in_revoked'
    END,
    updated_at = now()
  WHERE ob.status = 'pending'::public.outbox_status
    AND ob.channel = 'email'::public.outbox_channel
    AND coalesce(ob.payload ->> 'kind', '') = 'campaign_segment'
    AND ob.payload ->> 'segment_kind' = p_segment_kind
    AND nullif(trim(ob.payload ->> 'user_id'), '') IS NOT NULL
    AND (ob.payload ->> 'user_id')::uuid = p_profile_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'cancelled', n);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_cancel_pending_campaign_segment_outbox(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_cancel_pending_campaign_segment_outbox(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_cancel_pending_campaign_segment_outbox(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.staff_cancel_pending_marketing_campaign_outbox(p_profile_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.staff_cancel_pending_campaign_segment_outbox(p_profile_id, 'marketing_consent');
$$;

CREATE OR REPLACE FUNCTION public.staff_cancel_pending_newsletter_campaign_outbox(p_profile_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.staff_cancel_pending_campaign_segment_outbox(p_profile_id, 'newsletter_opt_in');
$$;

REVOKE ALL ON FUNCTION public.staff_cancel_pending_marketing_campaign_outbox(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_cancel_pending_marketing_campaign_outbox(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_cancel_pending_marketing_campaign_outbox(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.staff_cancel_pending_newsletter_campaign_outbox(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_cancel_pending_newsletter_campaign_outbox(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_cancel_pending_newsletter_campaign_outbox(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Profili: telefono, tag CRM, fase lead (staff-editable).
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS crm_tags text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lead_stage text;

COMMENT ON COLUMN public.profiles.phone IS 'Telefono contatto CRM (testo libero; consigliato E.164 se notifiche automatiche).';
COMMENT ON COLUMN public.profiles.crm_tags IS 'Tag staff per segmentazione leggera (array testo).';
COMMENT ON COLUMN public.profiles.lead_stage IS 'Fase lead opzionale (testo libero, es. cold / warm / visit).';

-- ---------------------------------------------------------------------------
-- Campagne: segmento iscritti in lista d'attesa (event_registrations.waitlisted).
-- ---------------------------------------------------------------------------
ALTER TABLE public.comms_campaigns DROP CONSTRAINT IF EXISTS comms_campaigns_segment_kind_check;
ALTER TABLE public.comms_campaigns
  ADD CONSTRAINT comms_campaigns_segment_kind_check
  CHECK (segment_kind IN ('newsletter_opt_in', 'marketing_consent', 'registration_waitlisted'));
