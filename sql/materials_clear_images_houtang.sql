-- 仅清空吼堂物料的图片字段（不删行），用于先下线裂图、再补传 OSS 后重跑 image SQL。

BEGIN;

UPDATE materials m
SET
  image = NULL,
  image_filename = NULL,
  image_data = NULL
FROM brands b
WHERE m.restaurant_brand_id = b.id
  AND b.name = '吼堂';

COMMIT;
