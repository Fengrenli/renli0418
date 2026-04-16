-- 审计 materials.code 重复（会导致 JOIN 算量行数膨胀、前端串图/串名）
-- 在 psql 中执行，根据结果做数据清洗后再加 UNIQUE（若尚未有唯一约束）

SELECT code, COUNT(*) AS n, array_agg(id ORDER BY id) AS material_ids
FROM materials
WHERE code IS NOT NULL AND TRIM(code) <> ''
GROUP BY code
HAVING COUNT(*) > 1
ORDER BY n DESC, code;

-- 可选：查看重复行明细
-- SELECT * FROM materials WHERE code IN (
--   SELECT code FROM materials WHERE code IS NOT NULL GROUP BY code HAVING COUNT(*) > 1
-- ) ORDER BY code, id;

-- 清洗完成后可考虑（会失败若仍有重复）：
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_materials_code ON materials (code) WHERE code IS NOT NULL;
