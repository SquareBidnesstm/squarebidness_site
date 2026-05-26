-- =========================================================
-- Migration 011: Fix decrement trigger to handle checked_in → cancelled/refunded
-- =========================================================
-- The existing trg_decrement_quantity_sold only fires when OLD.status = 'valid'.
-- This means tickets that were scanned in (checked_in) and then cancelled/refunded
-- never had their capacity slot freed, causing permanent oversell of that slot.
-- Fix: also fire when OLD.status = 'checked_in'.
-- =========================================================

CREATE OR REPLACE FUNCTION public.decrement_tier_quantity_sold()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Decrement when a ticket transitions from an active state to cancelled/refunded
  IF NEW.status IN ('cancelled', 'refunded')
     AND OLD.status IN ('valid', 'checked_in') THEN
    UPDATE public.ticket_tiers
    SET quantity_sold = GREATEST(quantity_sold - 1, 0)
    WHERE id = NEW.tier_id;
  END IF;
  RETURN NEW;
END;
$$;
