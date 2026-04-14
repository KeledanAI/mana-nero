-- Staff-only aggregate counts for email outbox (kind × status) for admin metrics.

CREATE OR REPLACE FUNCTION public.outbox_email_stats_for_staff()
RETURNS TABLE (
  kind text,
  status text,
  n bigint
)
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
    coalesce(ob.payload ->> 'kind', 'unknown')::text AS kind,
    ob.status::text AS status,
    count(*)::bigint AS n
  FROM public.communication_outbox ob
  WHERE ob.channel = 'email'::public.outbox_channel
  GROUP BY 1, 2
  ORDER BY n DESC, kind ASC, status ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.outbox_email_stats_for_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.outbox_email_stats_for_staff() TO service_role;
