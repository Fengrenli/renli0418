-- 检查 proj-1775203736057 项目的 digital_assets 字段
SELECT 
    id, 
    name, 
    digital_assets,
    pg_typeof(digital_assets) as data_type
FROM projects 
WHERE id = 'proj-1775203736057';

-- 如果 digital_assets 是字符串，查看其内容
SELECT 
    id,
    name,
    CASE 
        WHEN pg_typeof(digital_assets) = 'text' THEN digital_assets::text
        ELSE digital_assets::jsonb::text
    END as digital_assets_content
FROM projects 
WHERE id = 'proj-1775203736057';
