-- 删除现有的 materials 表（如果存在）
DROP TABLE IF EXISTS materials;

-- 合并后的 materials 表结构，包含两个表的所有字段
CREATE TABLE materials (
  id SERIAL PRIMARY KEY,
  -- 基本信息
  code VARCHAR(255) UNIQUE,         -- 材料编码
  name VARCHAR(255) NOT NULL,       -- 材料名称
  description TEXT,                 -- 材料描述
  price DECIMAL(10, 2),             -- 价格
  unit TEXT,                        -- 单位
  category TEXT,                    -- 分类
  brand TEXT,                       -- 品牌
  hs_code VARCHAR(50),              -- HS编码
  weight DECIMAL(10, 2),            -- 重量
  volume DECIMAL(10, 2),            -- 体积
  qty DECIMAL(10, 2),               -- 数量
  
  -- 规格信息
  spec VARCHAR(255),                -- 规格
  specs JSONB,                      -- 规格信息（包含长度、宽度、高度等）
  specification VARCHAR(255),       -- 规格（products表）
  
  -- 位置信息
  location_info JSONB,              -- 位置信息（包含区域、位置、装箱号等）
  
  -- 材料信息
  material_info JSONB,              -- 材料信息（包含材质、颜色等）
  
  -- 图片信息
  image TEXT,                       -- 图片URL
  image_filename VARCHAR(255),      -- 图片文件名
  image_data TEXT,                  -- 图片数据（products表）
  
  -- 其他信息
  remarks TEXT,                     -- 备注（products表）
  tags TEXT,                        -- 标签（products表）
  
  -- 时间信息
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
  update_time TIMESTAMP,                          -- 更新时间
  
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_code ON materials (code);
CREATE INDEX IF NOT EXISTS idx_name ON materials (name);
CREATE INDEX IF NOT EXISTS idx_category ON materials (category);
CREATE INDEX IF NOT EXISTS idx_brand ON materials (brand);

-- 同步 products 表数据到 materials 表的 SQL 语句
INSERT INTO materials (
  code, name, description, price, unit, category, brand, hs_code, weight, volume, qty,
  spec, specs, specification,
  location_info,
  material_info,
  image, image_filename, image_data,
  remarks, tags,
  create_time, update_time
) SELECT
  id as code,  -- 使用 products.id 作为 code
  name,
  NULL as description,  -- products表没有description字段
  price,
  unit,
  category,
  brand,
  hs_code,
  weight,
  NULL as volume,  -- products表没有volume字段
  NULL as qty,     -- products表没有qty字段
  NULL as spec,    -- products表没有spec字段
  NULL as specs,   -- products表没有specs字段
  specification,
  NULL as location_info,   -- products表没有location_info字段
  NULL as material_info,   -- products表没有material_info字段
  image,
  NULL as image_filename,  -- products表没有image_filename字段
  image_data,
  remarks,
  tags,
  create_time,
  update_time
FROM products
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  unit = EXCLUDED.unit,
  category = EXCLUDED.category,
  brand = EXCLUDED.brand,
  hs_code = EXCLUDED.hs_code,
  weight = EXCLUDED.weight,
  specs = EXCLUDED.specs,
  specification = EXCLUDED.specification,
  location_info = EXCLUDED.location_info,
  material_info = EXCLUDED.material_info,
  image = EXCLUDED.image,
  image_data = EXCLUDED.image_data,
  remarks = EXCLUDED.remarks,
  tags = EXCLUDED.tags,
  update_time = EXCLUDED.update_time;
