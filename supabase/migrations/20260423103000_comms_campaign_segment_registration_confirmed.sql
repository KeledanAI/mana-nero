-- Comms: segmento campagna `registration_confirmed` (profili con almeno un'iscrizione confermata).

ALTER TABLE public.comms_campaigns DROP CONSTRAINT IF EXISTS comms_campaigns_segment_kind_check;

ALTER TABLE public.comms_campaigns
  ADD CONSTRAINT comms_campaigns_segment_kind_check
  CHECK (
    segment_kind IN (
      'newsletter_opt_in',
      'marketing_consent',
      'registration_waitlisted',
      'registration_confirmed'
    )
  );

COMMENT ON CONSTRAINT comms_campaigns_segment_kind_check ON public.comms_campaigns IS
  'Segmenti staff per record campagna; registration_confirmed = almeno un''iscrizione event_registration confirmed.';
