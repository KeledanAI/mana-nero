-- Staff analytics: outbox campaign_segment rows grouped by payload campaign_id (slug) and status, optional time window.

CREATE OR REPLACE FUNCTION public.analytics_outbox_campaign_segment_stats_by_slug(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (campaign_id text, status text, n bigint)
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
    coalesce(nullif(btrim(ob.payload ->> 'campaign_id'), ''), '(senza slug)') AS campaign_id,
    ob.status::text AS status,
    count(*)::bigint AS n
  FROM public.communication_outbox ob
  WHERE ob.channel = 'email'::public.outbox_channel
    AND coalesce(ob.payload ->> 'kind', '') = 'campaign_segment'
    AND (p_since IS NULL OR ob.created_at >= p_since)
  GROUP BY 1, 2
  ORDER BY campaign_id ASC, n DESC, status ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.analytics_outbox_campaign_segment_stats_by_slug(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.analytics_outbox_campaign_segment_stats_by_slug(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_outbox_campaign_segment_stats_by_slug(timestamptz) TO service_role;
