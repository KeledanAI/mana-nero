-- QR self check-in: token per iscrizione confermata, RPC anon-friendly, invalidazione a check-in.

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS check_in_token uuid;

CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_check_in_token_key
  ON public.event_registrations (check_in_token)
  WHERE check_in_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.event_registrations_check_in_token_biu()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'checked_in' THEN
    NEW.check_in_token := NULL;
  ELSIF NEW.status = 'confirmed' AND NEW.check_in_token IS NULL THEN
    NEW.check_in_token := gen_random_uuid();
  ELSIF NEW.status IN ('cancelled', 'waitlisted', 'pending_payment') THEN
    NEW.check_in_token := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_registrations_check_in_token_biu ON public.event_registrations;
CREATE TRIGGER event_registrations_check_in_token_biu
  BEFORE INSERT OR UPDATE ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.event_registrations_check_in_token_biu();

-- Righe già confermate: genera token (il trigger copre gli UPDATE successivi su status).
UPDATE public.event_registrations
SET check_in_token = gen_random_uuid()
WHERE status = 'confirmed'
  AND check_in_token IS NULL;

COMMENT ON COLUMN public.event_registrations.check_in_token IS
  'UUID opaco per link/QR self check-in; nullo se non confermato o già usato.';

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

  SELECT e.starts_at, e.status INTO v_starts, v_evt_status
  FROM public.events e
  WHERE e.id = v_reg.event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_not_found');
  END IF;

  IF v_evt_status <> 'published' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'event_not_published');
  END IF;

  -- Finestra permissiva: evita abusi grossolani senza richiedere orario esatto in fase 1.
  IF v_starts > now() + interval '60 days' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_early');
  END IF;

  IF v_starts < now() - interval '14 days' THEN
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

  RETURN jsonb_build_object('ok', true, 'status', 'checked_in', 'event_id', v_reg.event_id);
END;
$$;

REVOKE ALL ON FUNCTION public.event_check_in_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_check_in_by_token(uuid) TO anon, authenticated;
