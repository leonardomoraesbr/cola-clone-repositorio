ALTER TABLE public.payment_orders
  ALTER COLUMN plan_id DROP NOT NULL;

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS upsell_offer_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_orders_upsell_offer_id_fkey'
      AND conrelid = 'public.payment_orders'::regclass
  ) THEN
    ALTER TABLE public.payment_orders
      ADD CONSTRAINT payment_orders_upsell_offer_id_fkey
      FOREIGN KEY (upsell_offer_id)
      REFERENCES public.upsell_offers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_orders_upsell_offer_id
  ON public.payment_orders(upsell_offer_id);