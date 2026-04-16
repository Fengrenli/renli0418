-- BOM Configurator — Step 1
-- Target: PostgreSQL (Aliyun RDS / PolarDB-PG compatible)
-- Run: psql "$DATABASE_URL" -f migrations/001_bom_configurator_assembly_rules.sql
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1) materials: suggested waste rate (ratio, e.g. 0.10 = 10%)
-- ---------------------------------------------------------------------------
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS suggested_waste_rate NUMERIC(6, 4);

COMMENT ON COLUMN materials.suggested_waste_rate IS
  'Default/suggested waste ratio for BOM (0–1). Item-level rules may override in API.';

-- ---------------------------------------------------------------------------
-- 2) assembly_rules: scenario name + input unit (linear vs area)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assembly_rules (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(64) NOT NULL UNIQUE,
  name        VARCHAR(255) NOT NULL,
  unit        VARCHAR(32) NOT NULL,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assembly_rules_unit_chk CHECK (
    unit IN ('linear_meter', 'sqm', 'each')
  )
);

COMMENT ON TABLE assembly_rules IS
  'Engineering BOM scenarios (e.g. eaves per linear meter, wall per sqm). API scenario_id maps to assembly_rules.code.';
COMMENT ON COLUMN assembly_rules.code IS
  'Stable machine id for POST /api/v1/calculate-bom scenario_id.';
COMMENT ON COLUMN assembly_rules.unit IS
  'Input dimension: linear_meter (门头屋檐等), sqm (墙面等), each (optional future).';

CREATE INDEX IF NOT EXISTS idx_assembly_rules_active_sort
  ON assembly_rules (is_active, sort_order);

-- ---------------------------------------------------------------------------
-- 3) rule_items: per-scenario coefficients tied to materials.code
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rule_items (
  id                       SERIAL PRIMARY KEY,
  assembly_rule_id         INT NOT NULL REFERENCES assembly_rules (id) ON DELETE CASCADE,
  material_code            VARCHAR(255) NOT NULL REFERENCES materials (code) ON DELETE RESTRICT,
  base_quantity_per_unit   NUMERIC(18, 6) NOT NULL,
  label                    VARCHAR(255),
  sort_order               INT NOT NULL DEFAULT 0,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rule_items_qty_positive CHECK (base_quantity_per_unit > 0),
  CONSTRAINT rule_items_rule_material_uniq UNIQUE (assembly_rule_id, material_code)
);

COMMENT ON TABLE rule_items IS
  'Quantity per 1 unit of scenario input (e.g. pieces per linear meter or per sqm).';
COMMENT ON COLUMN rule_items.base_quantity_per_unit IS
  'Pieces (or order units) per 1 linear_meter or 1 sqm depending on parent assembly_rules.unit.';

CREATE INDEX IF NOT EXISTS idx_rule_items_rule_id ON rule_items (assembly_rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_items_material_code ON rule_items (material_code);

-- ---------------------------------------------------------------------------
-- Optional seed (Atlanta-derived rules). Uncomment only if rows exist in materials.
-- Expected codes: ABETH-002, ABDET-001, ABMRR-001, ABCEC-002
-- plus 五件套 line — use a single placeholder code if you model "套件" as one SKU.
-- ---------------------------------------------------------------------------
/*
INSERT INTO assembly_rules (code, name, unit, description, sort_order)
VALUES
  ('eaves_linear', '屋檐场景（延米）', 'linear_meter', '门头延伸 1.2–1.5m 屋檐用量；损耗在 API 层统一 10%。', 10),
  ('wall_area_brick_only', '墙面场景（青砖散砖）', 'sqm', '旧青砖片 ABMRR-001；高损耗预警 35–40%。', 20),
  ('wall_area_panel_only', '墙面场景（预制墙板）', 'sqm', 'ABCEC-002，单板 0.702㎡；损耗约 3%。', 30),
  ('wall_area_hybrid', '墙面场景（板+散砖收口）', 'sqm', '大面积预制板 + 约 5% 面积散砖收口（组合逻辑在 API）。', 40)
ON CONFLICT (code) DO NOTHING;

-- Map rule id by code in application or use subselects:
-- 筒瓦 25/米, 普通瓦 35/米, 五件套 5对/米 → 五件套若拆成多物料请拆多行 rule_items

INSERT INTO rule_items (assembly_rule_id, material_code, base_quantity_per_unit, label, sort_order)
SELECT r.id, v.material_code, v.qty, v.label, v.sort_order
FROM assembly_rules r
JOIN (VALUES
  ('eaves_linear', 'ABETH-002', 25::numeric, '筒瓦 片/米', 1),
  ('eaves_linear', 'ABDET-001', 35::numeric, '普通瓦片 片/米', 2)
  -- ('eaves_linear', 'YOUR-RIDGE-CODE', 5::numeric, '正脊挡沟滴水等对/米', 3)
) AS v(rule_code, material_code, qty, label, sort_order)
  ON r.code = v.rule_code
ON CONFLICT (assembly_rule_id, material_code) DO NOTHING;

INSERT INTO rule_items (assembly_rule_id, material_code, base_quantity_per_unit, label, sort_order)
SELECT r.id, 'ABMRR-001', 80::numeric, '旧青砖片 片/㎡', 1
FROM assembly_rules r WHERE r.code = 'wall_area_brick_only'
ON CONFLICT (assembly_rule_id, material_code) DO NOTHING;

INSERT INTO rule_items (assembly_rule_id, material_code, base_quantity_per_unit, label, sort_order)
SELECT r.id, 'ABCEC-002', (1 / 0.702)::numeric, '预制墙板 块/㎡ (1.2×0.585)', 1
FROM assembly_rules r WHERE r.code = 'wall_area_panel_only'
ON CONFLICT (assembly_rule_id, material_code) DO NOTHING;
*/
