# Materials 一键重建 Runbook（14 分类）

本流程用于“推倒重来”重建 `materials`，确保：

- `category` = 14 类（与 Excel 分表名一致）
- `pic_folder` 入库
- `image` 可直接访问 OSS，前端不再猜路径

## 0. 前置路径（本机当前约定）

- Excel 源目录：`C:\Users\Admin\Desktop\material\new\material-excel`
- 图片根目录：`C:\Users\Admin\Desktop\material\new\PIC`
- 项目目录：`E:\renli0418`

## 1. 一键生成重建产物（本地）

在 PowerShell 执行：

```powershell
Set-Location E:\renli0418

python .\scripts\material_code_dedupe\merge_material_excel_folder.py `
  "C:\Users\Admin\Desktop\material\new\material-excel" `
  -o ".\materials_raw_from_excel_merged.csv" `
  --dup-report ".\materials_excel_code_duplicates.csv"

python .\scripts\material_code_dedupe\clean_material_codes.py `
  ".\materials_raw_from_excel_merged.csv" `
  --mode all-rows `
  -o ".\materials_cleaned.csv" `
  -m ".\code_mapping.csv" `
  --shell-commands ".\rename_pic_local.sh"

python .\scripts\material_code_dedupe\materials_csv_strip_for_rds.py `
  -i ".\materials_cleaned.csv" `
  -o ".\materials_cleaned_for_rds_v3.csv"

python .\scripts\material_code_dedupe\sql_update_materials_pic_folder_image.py `
  -i ".\materials_cleaned.csv" `
  -o ".\sql\materials_pic_image_update_v3.sql"
```

产物：

- `materials_cleaned_for_rds_v3.csv`（DMS 导入文件）
- `sql/materials_pic_image_update_v3.sql`（批量回填 `image` + `pic_folder`）

## 2. DMS / RDS 执行顺序（数据库）

### 2.1 清空 materials（只清数据）

```sql
TRUNCATE TABLE materials RESTART IDENTITY;
```

### 2.2 确保列存在（只需一次）

```sql
ALTER TABLE materials ADD COLUMN IF NOT EXISTS pic_folder TEXT;
```

### 2.3 DMS 导入 CSV

- 文件：`materials_cleaned_for_rds_v3.csv`
- 目标表：`materials`
- 编码：`UTF-8`
- 写入方式：`INSERT`

CSV 关键列应包含：
`id,code,name,price,category,image,...,pic_folder`

### 2.4 回填图片 URL（强烈推荐）

执行：

`sql/materials_pic_image_update_v3.sql`

该 SQL 会按 `code` 写入：

- `pic_folder`
- `image = https://renli2026.oss-cn-chengdu.aliyuncs.com/materials/<pic_folder>/<code>.<ext>`

## 3. 验收 SQL（复制即用）

```sql
-- 1) 总数
SELECT COUNT(*) AS total FROM materials;

-- 2) 分类应为 14
SELECT COUNT(DISTINCT category) AS category_cnt FROM materials;
SELECT DISTINCT category FROM materials ORDER BY 1;

-- 3) 图片/目录完整性
SELECT
  COUNT(*) AS total,
  COUNT(NULLIF(TRIM(COALESCE(pic_folder, '')), '')) AS has_pic_folder,
  COUNT(NULLIF(TRIM(COALESCE(image, '')), '')) AS has_image
FROM materials;
```

期望：

- `total = 179`
- `category_cnt = 14`
- `has_pic_folder = 179`
- `has_image = 179`

## 4. 常见故障

- 报 `pic_folder 字段不存在`：
  先执行 `ALTER TABLE ... ADD COLUMN pic_folder`
- 导入成功但大量裂图：
  通常是 `image` 为空，补跑 `materials_pic_image_update_v3.sql`
- 分类不是 14：
  检查 `scripts/material_code_dedupe/excel_category_map.json` 是否仍是 14 类同名映射

