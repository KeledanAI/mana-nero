-- V2-lite preordini: campi additivi e stato awaiting_stock (PRD §4.4 / ROADMAP v2-product-preorders).

ALTER TABLE public.product_reservation_requests
  ADD COLUMN IF NOT EXISTS expected_fulfillment_at timestamptz,
  ADD COLUMN IF NOT EXISTS stock_notified_at timestamptz;

DO $$ BEGIN
  ALTER TYPE public.product_request_status ADD VALUE 'awaiting_stock';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
