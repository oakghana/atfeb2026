-- Migration: Create location_inventory and stock_movements, plus transfer_stock function
-- Run in Postgres (Supabase SQL editor / psql)

BEGIN;

-- Create location_inventory table to track per-location stock quantities
CREATE TABLE IF NOT EXISTS public.location_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  item_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_location_item_unique ON public.location_inventory (location_id, item_id);

-- Create stock_movements table to audit transfers/issuances
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  quantity numeric NOT NULL,
  from_location_id uuid NULL,
  to_location_id uuid NULL,
  requisition_id uuid NULL,
  performed_by uuid NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON public.stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_requisition ON public.stock_movements(requisition_id);

-- Create a function to perform an atomic transfer (decrement from source, increment to destination)
CREATE OR REPLACE FUNCTION public.transfer_stock(
  p_item_id uuid,
  p_quantity numeric,
  p_from_location uuid,
  p_to_location uuid,
  p_requisition_id uuid,
  p_performed_by uuid,
  p_notes text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Validate quantity
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  -- Ensure source inventory row exists (if from_location provided)
  IF p_from_location IS NOT NULL THEN
    INSERT INTO public.location_inventory (location_id, item_id, quantity)
    VALUES (p_from_location, p_item_id, 0)
    ON CONFLICT (location_id, item_id) DO NOTHING;

    -- Check available quantity
    PERFORM 1 FROM public.location_inventory WHERE location_id = p_from_location AND item_id = p_item_id AND quantity >= p_quantity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock at source location';
    END IF;

    -- Decrement source
    UPDATE public.location_inventory
    SET quantity = quantity - p_quantity, updated_at = now()
    WHERE location_id = p_from_location AND item_id = p_item_id;
  END IF;

  -- Ensure destination inventory row exists (if to_location provided)
  IF p_to_location IS NOT NULL THEN
    INSERT INTO public.location_inventory (location_id, item_id, quantity)
    VALUES (p_to_location, p_item_id, 0)
    ON CONFLICT (location_id, item_id) DO NOTHING;

    -- Increment destination
    UPDATE public.location_inventory
    SET quantity = quantity + p_quantity, updated_at = now()
    WHERE location_id = p_to_location AND item_id = p_item_id;
  END IF;

  -- Record movement in audit table
  INSERT INTO public.stock_movements (item_id, quantity, from_location_id, to_location_id, requisition_id, performed_by, notes)
  VALUES (p_item_id, p_quantity, p_from_location, p_to_location, p_requisition_id, p_performed_by, p_notes);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS as appropriate (policy examples - adjust to your auth setup)
ALTER TABLE public.location_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Policy: allow authenticated users to select their location inventory (example)
CREATE POLICY "Select location inventory for authenticated" ON public.location_inventory
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Policy: allow inserts/updates via service role (recommend to use admin RPCs)
CREATE POLICY "Service role can modify inventory" ON public.location_inventory
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMIT;

-- Note: Adjust RLS policies to match your Supabase auth setup. The transfer_stock function is SECURITY DEFINER to allow atomic updates; ensure function ownership and privileges are reviewed before deploying to production.
