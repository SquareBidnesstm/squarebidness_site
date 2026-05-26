CREATE OR REPLACE FUNCTION increment_promo_uses(promo_id uuid)
RETURNS void LANGUAGE sql AS $$
  UPDATE promo_codes SET uses = uses + 1 WHERE id = promo_id;
$$;
