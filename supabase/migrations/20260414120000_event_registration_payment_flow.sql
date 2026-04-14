-- V2 payments: extend booking RPC, partial unique index, paid_at; service_role-only confirm/expire.
-- Requires registration_status pending_payment (20260413180000).

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

DO $$ BEGIN
  ALTER TYPE public.app_registration_action ADD VALUE 'confirm_payment';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.app_registration_action ADD VALUE 'expire_payment';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DROP INDEX IF EXISTS public.event_registrations_one_active_per_user_event;

CREATE UNIQUE INDEX event_registrations_one_active_per_user_event
  ON public.event_registrations (event_id, user_id)
  WHERE status IN ('confirmed', 'waitlisted', 'pending_payment');

-- Replace RPC: add p_payment_intent_id; book handles paid events; confirm/expire for service_role JWT only.
DROP FUNCTION IF EXISTS public.event_registration_action(
  public.app_registration_action,
  uuid,
  uuid
);

CREATE OR REPLACE FUNCTION public.event_registration_action(
  p_operation public.app_registration_action,
  p_event_id uuid DEFAULT NULL,
  p_registration_id uuid DEFAULT NULL,
  p_payment_intent_id text DEFAULT NULL
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
  v_price_cents integer;
  v_dep_cents integer;
  v_requires_payment boolean;
  v_confirmed integer;
  v_reg public.event_registrations%ROWTYPE;
  v_next_pos integer;
  v_promo_id uuid;
  v_promo_event_id uuid;
  v_event_needs_pay boolean;
  v_is_service boolean := coalesce((auth.jwt() ->> 'role') = 'service_role', false);
BEGIN
  IF p_operation IN ('confirm_payment', 'expire_payment') THEN
    IF NOT v_is_service THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  ELSIF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_operation = 'book' THEN
    IF p_event_id IS NULL THEN
      RAISE EXCEPTION 'event_id_required';
    END IF;

    SELECT
      e.capacity,
      e.status,
      coalesce(e.price_cents, 0),
      coalesce(e.deposit_cents, 0)
    INTO v_cap, v_evt_status, v_price_cents, v_dep_cents
    FROM public.events e
    WHERE e.id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'event_not_found';
    END IF;
    IF v_evt_status <> 'published' THEN
      RAISE EXCEPTION 'event_not_bookable';
    END IF;

    v_requires_payment := (v_price_cents > 0 OR v_dep_cents > 0);

    SELECT * INTO v_reg
    FROM public.event_registrations
    WHERE event_id = p_event_id
      AND user_id = v_uid
      AND status IN ('confirmed', 'waitlisted', 'pending_payment')
    FOR UPDATE;

    IF FOUND THEN
      RAISE EXCEPTION 'already_registered';
    END IF;

    SELECT count(*)::integer INTO v_confirmed
    FROM public.event_registrations
    WHERE event_id = p_event_id
      AND status IN ('confirmed', 'pending_payment');

    IF v_confirmed < v_cap THEN
      IF v_requires_payment THEN
        INSERT INTO public.event_registrations (event_id, user_id, status, waitlist_position)
        VALUES (p_event_id, v_uid, 'pending_payment', NULL);

        INSERT INTO public.communication_outbox (
          idempotency_key, channel, payload, status
        ) VALUES (
          'booking_pending_payment:' || p_event_id::text || ':' || v_uid::text,
          'email',
          jsonb_build_object(
            'kind', 'booking_pending_payment',
            'event_id', p_event_id,
            'user_id', v_uid,
            'registration_status', 'pending_payment'
          ),
          'pending'
        )
        ON CONFLICT (idempotency_key) DO NOTHING;

        RETURN jsonb_build_object('ok', true, 'status', 'pending_payment');
      END IF;

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

    SELECT coalesce(max(waitlist_position), 0) + 1 INTO v_next_pos
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
      AND status IN ('confirmed', 'waitlisted', 'pending_payment')
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'registration_not_found';
    END IF;

    UPDATE public.event_registrations
    SET status = 'cancelled',
        waitlist_position = NULL,
        updated_at = now()
    WHERE id = v_reg.id;

    IF v_reg.status IN ('confirmed', 'pending_payment') THEN
      SELECT id INTO v_promo_id
      FROM public.event_registrations
      WHERE event_id = p_event_id
        AND status = 'waitlisted'
      ORDER BY waitlist_position ASC NULLS LAST, created_at ASC
      LIMIT 1
      FOR UPDATE;

      IF v_promo_id IS NOT NULL THEN
        SELECT (COALESCE(e.price_cents, 0) > 0 OR COALESCE(e.deposit_cents, 0) > 0)
        INTO v_event_needs_pay
        FROM public.events e
        WHERE e.id = p_event_id;

        IF v_event_needs_pay THEN
          UPDATE public.event_registrations
          SET status = 'pending_payment',
              waitlist_position = NULL,
              updated_at = now()
          WHERE id = v_promo_id;

          INSERT INTO public.communication_outbox (
            idempotency_key, channel, payload, status
          ) VALUES (
            'booking_pending_payment:' || p_event_id::text || ':' || (
              SELECT user_id FROM public.event_registrations WHERE id = v_promo_id
            )::text,
            'email',
            jsonb_build_object(
              'kind', 'booking_pending_payment',
              'event_id', p_event_id,
              'user_id', (
                SELECT user_id FROM public.event_registrations WHERE id = v_promo_id
              ),
              'registration_status', 'pending_payment'
            ),
            'pending'
          )
          ON CONFLICT (idempotency_key) DO NOTHING;
        ELSE
          UPDATE public.event_registrations
          SET status = 'confirmed',
              waitlist_position = NULL,
              updated_at = now()
          WHERE id = v_promo_id;

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

  IF p_operation = 'confirm_payment' THEN
    IF p_registration_id IS NULL THEN
      RAISE EXCEPTION 'registration_id_required';
    END IF;

    SELECT * INTO v_reg
    FROM public.event_registrations
    WHERE id = p_registration_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'registration_not_found';
    END IF;

    IF v_reg.status = 'confirmed' THEN
      RETURN jsonb_build_object('ok', true, 'status', 'confirmed', 'idempotent', true);
    END IF;

    IF v_reg.status <> 'pending_payment' THEN
      RAISE EXCEPTION 'registration_not_pending_payment';
    END IF;

    UPDATE public.event_registrations
    SET status = 'confirmed',
        payment_intent_id = coalesce(p_payment_intent_id, payment_intent_id),
        payment_status = 'paid',
        paid_at = now(),
        updated_at = now()
    WHERE id = p_registration_id;

    INSERT INTO public.communication_outbox (
      idempotency_key, channel, payload, status
    ) VALUES (
      'payment_confirmed:' || p_registration_id::text,
      'email',
      jsonb_build_object(
        'kind', 'payment_confirmed',
        'event_id', v_reg.event_id,
        'user_id', v_reg.user_id,
        'registration_status', 'confirmed'
      ),
      'pending'
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN jsonb_build_object('ok', true, 'status', 'confirmed');
  END IF;

  IF p_operation = 'expire_payment' THEN
    IF p_registration_id IS NULL THEN
      RAISE EXCEPTION 'registration_id_required';
    END IF;

    SELECT * INTO v_reg
    FROM public.event_registrations
    WHERE id = p_registration_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'registration_not_found';
    END IF;

    IF v_reg.status = 'cancelled' THEN
      RETURN jsonb_build_object('ok', true, 'status', 'cancelled', 'idempotent', true);
    END IF;

    IF v_reg.status <> 'pending_payment' THEN
      RAISE EXCEPTION 'registration_not_pending_payment';
    END IF;

    UPDATE public.event_registrations
    SET status = 'cancelled',
        waitlist_position = NULL,
        updated_at = now()
    WHERE id = p_registration_id;

    v_promo_event_id := v_reg.event_id;

    SELECT id INTO v_promo_id
    FROM public.event_registrations
    WHERE event_id = v_promo_event_id
      AND status = 'waitlisted'
    ORDER BY waitlist_position ASC NULLS LAST, created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF v_promo_id IS NOT NULL THEN
      SELECT (COALESCE(e.price_cents, 0) > 0 OR COALESCE(e.deposit_cents, 0) > 0)
      INTO v_event_needs_pay
      FROM public.events e
      WHERE e.id = v_promo_event_id;

      IF v_event_needs_pay THEN
        UPDATE public.event_registrations
        SET status = 'pending_payment',
            waitlist_position = NULL,
            updated_at = now()
        WHERE id = v_promo_id;

        INSERT INTO public.communication_outbox (
          idempotency_key, channel, payload, status
        ) VALUES (
          'booking_pending_payment:' || v_promo_event_id::text || ':' || (
            SELECT user_id FROM public.event_registrations WHERE id = v_promo_id
          )::text,
          'email',
          jsonb_build_object(
            'kind', 'booking_pending_payment',
            'event_id', v_promo_event_id,
            'user_id', (
              SELECT user_id FROM public.event_registrations WHERE id = v_promo_id
            ),
            'registration_status', 'pending_payment'
          ),
          'pending'
        )
        ON CONFLICT (idempotency_key) DO NOTHING;
      ELSE
        UPDATE public.event_registrations
        SET status = 'confirmed',
            waitlist_position = NULL,
            updated_at = now()
        WHERE id = v_promo_id;

        INSERT INTO public.communication_outbox (
          idempotency_key, channel, payload, status
        ) VALUES (
          'promoted_from_waitlist:' || v_promo_event_id::text || ':' || v_promo_id::text,
          'email',
          jsonb_build_object(
            'kind', 'waitlist_promoted',
            'event_id', v_promo_event_id,
            'user_id', (
              SELECT user_id FROM public.event_registrations WHERE id = v_promo_id
            )
          ),
          'pending'
        )
        ON CONFLICT (idempotency_key) DO NOTHING;
      END IF;

      WITH numbered AS (
        SELECT id,
               row_number() OVER (
                 ORDER BY waitlist_position ASC NULLS LAST, created_at ASC
               ) AS n
        FROM public.event_registrations
        WHERE event_id = v_promo_event_id
          AND status = 'waitlisted'
      )
      UPDATE public.event_registrations er
      SET waitlist_position = numbered.n,
          updated_at = now()
      FROM numbered
      WHERE er.id = numbered.id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'status', 'cancelled');
  END IF;

  RAISE EXCEPTION 'unsupported_operation';
END;
$$;

GRANT EXECUTE ON FUNCTION public.event_registration_action(
  public.app_registration_action,
  uuid,
  uuid,
  text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.event_registration_action(
  public.app_registration_action,
  uuid,
  uuid,
  text
) TO service_role;
