-- Multi-brand materials uniqueness migration
-- Goal: allow same material code across different brands,
-- while keeping code unique inside each brand.

BEGIN;

-- 1) Ensure brand field exists
ALTER TABLE materials ADD COLUMN IF NOT EXISTS restaurant_brand_id INTEGER;

-- 2) Remove old global-unique constraint/index on code if exists
ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_code_key;
DROP INDEX IF EXISTS idx_materials_code_unique;
DROP INDEX IF EXISTS ux_materials_code;

-- 3) Add composite unique index: one code per brand
CREATE UNIQUE INDEX IF NOT EXISTS ux_materials_brand_code
ON materials (restaurant_brand_id, code);

COMMIT;

