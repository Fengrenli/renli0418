-- Bind all current materials to one brand by brand name.
-- Replace the brand name below before running.

BEGIN;

UPDATE materials
SET restaurant_brand_id = (
  SELECT id FROM brands WHERE name = '小龙坎' LIMIT 1
)
WHERE COALESCE(TRIM(code), '') <> '';

COMMIT;

