-- =============================================================================
-- materials.code 重附码后的库内「外科手术」模板（请在事务中、备份后执行）
-- 前置：已用 scripts/material_code_dedupe 生成 code_mapping.csv，
--       并已导入临时表 code_migration(id int, old_code text, new_code text)。
-- =============================================================================
-- 建议步骤：
-- 1) 备份全库；关闭应用写入；.env 勿长期保留 BOM_RULES_RESEED=1（避免每次启动清空规则）。
-- 2) 在 psql 中：
--    CREATE TEMP TABLE code_migration (id int primary key, old_code text, new_code text);
--    \copy code_migration FROM 'code_mapping.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');
--    （路径以实例为准；或用阿里云 DMS 导入同名正式表后再改下面 SQL 表名。）
-- 3) 解除外键 → 先改 rule_items（按「旧码」对齐到规范新码）→ 再按 id 更新 materials.code → 加回唯一约束与外键。
-- =============================================================================

BEGIN;

-- 外键名以实际库为准（\d rule_items 查看）；常见为 rule_items_material_code_fkey
ALTER TABLE rule_items DROP CONSTRAINT IF EXISTS rule_items_material_code_fkey;

-- rule_items：同一 old_code 在库中若对应多行物料，与算量接口一致取 id 最大者作为规范行
UPDATE rule_items ri
SET material_code = sub.canonical_new_code
FROM (
  SELECT DISTINCT ON (m.old_code)
    m.old_code,
    m.new_code AS canonical_new_code
  FROM code_migration m
  ORDER BY m.old_code, m.id DESC
) sub
WHERE ri.material_code = sub.old_code;

-- materials：按主键逐行更新编码（保证每行唯一）
UPDATE materials mat
SET code = m.new_code
FROM code_migration m
WHERE mat.id = m.id;

-- 建议：确认无重复、无空码
-- SELECT code, COUNT(*) FROM materials GROUP BY code HAVING COUNT(*) > 1;
-- SELECT COUNT(*) FROM materials WHERE code IS NULL OR trim(code) = '';

ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_code_key;
ALTER TABLE materials ADD CONSTRAINT materials_code_key UNIQUE (code);

ALTER TABLE rule_items
  ADD CONSTRAINT rule_items_material_code_fkey
  FOREIGN KEY (material_code) REFERENCES materials (code) ON DELETE RESTRICT;

COMMIT;

-- 迁移后请核对：
-- SELECT * FROM rule_items ORDER BY assembly_rule_id, sort_order;
-- POST /api/v1/calculate-bom 屋檐/墙面场景各跑一条。
