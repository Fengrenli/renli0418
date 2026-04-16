-- materials.id 为整表唯一主键（多品牌共用一张表时 id 连续递增，不会每个品牌从 1 重排）。
-- 若曾手动导入/恢复数据，SERIAL 序列可能小于 MAX(id)，INSERT 会报 duplicate key on materials_pkey。
-- 在 DMS 执行本脚本一次后再导入 CSV（INSERT）。

SELECT setval(
  pg_get_serial_sequence('materials', 'id'),
  GREATEST(0, COALESCE((SELECT MAX(id) FROM materials), 0))
);
