# Materials 多品牌导入（不清空）

目标：`materials` 一张表承载全部品牌，通过 `restaurant_brand_id` 隔离数据。

## 1) 一次性数据库准备

先执行：

- `sql/007_materials_brand_code_unique.sql`

这会把唯一约束改为 `(restaurant_brand_id, code)`，允许不同品牌复用同一 `code`。

## 2) 每次导入某品牌（不 TRUNCATE）

1. 生成该品牌 CSV（沿用现有 14 分类流程）
2. DMS 导入 `materials_cleaned_for_rds_v3.csv` 到 `materials`（INSERT）
3. 执行品牌绑定 SQL（示例在 `sql/materials_bind_brand_by_name.sql`）
4. 执行图片回填 SQL（按当前导入批次）

## 3) 品牌绑定 SQL（示例）

```sql
UPDATE materials
SET restaurant_brand_id = (
  SELECT id FROM brands WHERE name = '吼堂' LIMIT 1
)
WHERE COALESCE(TRIM(code), '') <> '';
```

> 如果是“本次新增批次”绑定，建议加上批次条件（如导入时间段或 code 前缀）。

## 4) 验收

```sql
-- 品牌分组统计
SELECT b.name AS brand_name, COUNT(*) AS cnt
FROM materials m
LEFT JOIN brands b ON b.id = m.restaurant_brand_id
GROUP BY b.name
ORDER BY cnt DESC;

-- 同品牌内重复 code 检查（应返回 0 行）
SELECT restaurant_brand_id, code, COUNT(*)
FROM materials
GROUP BY restaurant_brand_id, code
HAVING COUNT(*) > 1;
```

