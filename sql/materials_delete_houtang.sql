-- 删除「吼堂」品牌在 materials 表中的全部行，便于全量重导 CSV + 重跑图片 SQL。
-- 执行前请备份。若其它表引用 materials.id（外键），请先处理；BOM 行通常只存 material_id 字符串，一般无 FK。

BEGIN;

DELETE FROM materials m
USING brands b
WHERE m.restaurant_brand_id = b.id
  AND b.name = '吼堂';

COMMIT;
