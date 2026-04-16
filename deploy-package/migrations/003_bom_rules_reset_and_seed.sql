-- BOM 规则「大重置」+ 精准白名单（与 server.ts seedBomAssemblyRules 一致）
-- 在阿里云/本地 psql 手动执行；执行前请备份。
-- 屋檐 eaves_standard：正脊/筒瓦/板瓦/滴水/挡沟（库内须存在短码或 CE01-GYHG- 长码之一）
-- 墙面 wall_hybrid：仅预制板 + 青砖收口

TRUNCATE TABLE rule_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE assembly_rules RESTART IDENTITY CASCADE;

INSERT INTO assembly_rules (code, name, unit, description, sort_order)
VALUES
  ('eaves_standard', '中式标准屋檐 (亚特兰大同款)', 'linear_meter',
   '屋檐白名单：正脊/筒瓦/板瓦/滴水/挡沟；延米损耗 10%（API）。', 10),
  ('wall_hybrid', '数字化墙面方案 (预制+散砖收口)', 'sqm',
   '主材预制板 + 收口青砖片。', 20);

-- 以下 INSERT 仅在 materials.code 存在时成功；请按实际库内编码替换或先跑 002 去重
-- 筒瓦
INSERT INTO rule_items (assembly_rule_id, material_code, base_quantity_per_unit, label, sort_order)
SELECT ar.id, m.code, 25, '筒瓦 片/延米', 1
FROM assembly_rules ar, LATERAL (
  SELECT code FROM materials WHERE code IN ('ABETH-002', 'CE01-GYHG-ABETH-002') ORDER BY length(code) ASC LIMIT 1
) m
WHERE ar.code = 'eaves_standard';

-- 板瓦
INSERT INTO rule_items (assembly_rule_id, material_code, base_quantity_per_unit, label, sort_order)
SELECT ar.id, m.code, 35, '板瓦 片/延米', 2
FROM assembly_rules ar, LATERAL (
  SELECT code FROM materials WHERE code IN ('ABDET-001', 'CE01-GYHG-ABDET-001') ORDER BY length(code) ASC LIMIT 1
) m
WHERE ar.code = 'eaves_standard';

-- 正脊
INSERT INTO rule_items (assembly_rule_id, material_code, base_quantity_per_unit, label, sort_order)
SELECT ar.id, m.code, 2, '正脊 套/延米', 3
FROM assembly_rules ar, LATERAL (
  SELECT code FROM materials WHERE code IN ('ABHRG-002', 'ABHRG-001', 'CE01-GYHG-ABHRG-002', 'CE01-GYHG-ABHRG-001')
  ORDER BY length(code) ASC LIMIT 1
) m
WHERE ar.code = 'eaves_standard';

-- 滴水
INSERT INTO rule_items (assembly_rule_id, material_code, base_quantity_per_unit, label, sort_order)
SELECT ar.id, m.code, 1.5, '滴水 套/延米', 4
FROM assembly_rules ar, LATERAL (
  SELECT code FROM materials WHERE code IN ('ABTIE-001', 'CE01-GYHG-ABTIE-001') ORDER BY length(code) ASC LIMIT 1
) m
WHERE ar.code = 'eaves_standard';

-- 挡沟
INSERT INTO rule_items (assembly_rule_id, material_code, base_quantity_per_unit, label, sort_order)
SELECT ar.id, m.code, 1.5, '挡沟 套/延米', 5
FROM assembly_rules ar, LATERAL (
  SELECT code FROM materials WHERE code IN ('ABRAF-001', 'CE01-GYHG-ABRAF-001') ORDER BY length(code) ASC LIMIT 1
) m
WHERE ar.code = 'eaves_standard';

-- 预制板（主材）
INSERT INTO rule_items (assembly_rule_id, material_code, base_quantity_per_unit, label, sort_order)
SELECT ar.id, m.code, (1 / 0.702) * 0.95, '预制墙板 块/㎡（95% 面积）', 1
FROM assembly_rules ar, LATERAL (
  SELECT code FROM materials WHERE code IN ('ABCEC-002', 'CE01-GYHG-ABCEC-002') ORDER BY length(code) ASC LIMIT 1
) m
WHERE ar.code = 'wall_hybrid';

-- 青砖收口
INSERT INTO rule_items (assembly_rule_id, material_code, base_quantity_per_unit, label, sort_order)
SELECT ar.id, m.code, 80 * 0.05, '青砖片 片/㎡（5% 收口）', 2
FROM assembly_rules ar, LATERAL (
  SELECT code FROM materials WHERE code IN ('ABMRR-001', 'CE01-GYHG-ABMRR-001') ORDER BY length(code) ASC LIMIT 1
) m
WHERE ar.code = 'wall_hybrid';
