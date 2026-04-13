-- V2 additive: stato iscrizione in attesa di pagamento (nessun branch RPC ancora obbligatorio).
-- Estende solo l'enum; la logica event_registration_action va estesa in migrazione successiva.

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'registration_status'
      AND e.enumlabel = 'pending_payment'
  ) THEN
    ALTER TYPE public.registration_status ADD VALUE 'pending_payment';
  END IF;
END
$migration$;
