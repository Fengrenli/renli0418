# materials 重码清洗工具

流程：**导出 CSV → Python 生成分段式 `new_code` / 映射表 →（可选）重命名 PIC → 数据库事务更新**。

## 分段式编码标准

与《材料编码书写及命名规则》对齐，生成格式为：

`类别代码(4) - 颜色工艺(4) - 物料简写(3–5) - 流水号(3；同桶超过 999 时为 4)`

示例：`CE01-GYHG-ABETH-001`

| 段 | 来源 | 仓库配置 |
|----|------|----------|
| 类别四位 | `category` 中文 → `category_prefix_map.json`（与库内 12 大类一致） | 可增删键 |
| 颜色工艺四位 | `color` / `颜色` / `工艺颜色` 等列关键词 → `color_process_map.json`；无匹配则用 `_default`（默认 **GYHG**） | 可与《现行颜色代码》表对齐扩充 |
| 物料简写 | `name` 子串优先匹配 `material_abbr_hints.json`，否则英文词 / 中文拆段首字母，再兜底哈希 | 建议按《物料明细表》持续补全 |
| 流水号 | 同一「类别+颜色+简写」桶内按 `id` 升序编号，保证**全表唯一** | — |

若你手头有**标准 Excel 分类表 / 颜色表 / 物料简写表**，可直接发文件或贴 CSV，比从截图 OCR 更准；当前 JSON 已按你提供的 12 类 `category` 截图与规则图做了第一版映射。

## 环境

```bash
cd scripts/material_code_dedupe
pip install -r requirements.txt
```

## 导出

在阿里云 RDS / DMS 导出 `materials` 全表为 `materials_raw.csv`，**必须包含列**：`id`, `code`, `name`, `category`。  
若需自动匹配颜色段，请增加 `color` 或 `颜色` 等列（见脚本内 `COLOR_COLUMNS`）。

## 运行

仅修复「同一 code 多行」时（默认）：

```bash
python clean_material_codes.py materials_raw.csv \
  -o materials_cleaned.csv \
  -m code_mapping.csv \
  --shell-commands rename_pic.sh
```

全表按分段规则重算（更激进）：

```bash
python clean_material_codes.py materials_raw.csv --mode all-rows
```

强制默认颜色段（不读 `_default` 时）：

```bash
python clean_material_codes.py materials_raw.csv --default-color GYHG
```

## 输出文件

| 文件 | 说明 |
|------|------|
| `code_mapping.csv` | 每行物料 `id,old_code,new_code`，用于 `UPDATE materials` |
| `code_mapping_canonical_by_old_code.csv` | 每个旧 `code` 一条规范新码（同码多行取 **id 最大**），用于 `rule_items` 与 `PIC/{code}.png` |
| `materials_cleaned.csv` | 全表副本，`code` 已为 `new_code`，含 `code_before_cleanup` |
| `rename_pic.sh`（可选） | `mv -n 旧.png 新.png` |

图片 dry-run：

```bash
python clean_material_codes.py materials_raw.csv --rename-dry-run --apply-pic-rename
```

### 分类子文件夹（默认）

本地资源管理器结构为 `PIC/<分类文件夹>/<物料编码>.png` 时，使用默认 **`--pic-layout nested`**（无需写参数）。

- 子文件夹名默认与 CSV 的 **`category`** 一致；若磁盘上名称不同，编辑 **`category_pic_folder_map.json`**。
- **植物盆栽**：默认映射为图片落在 **`定制活动家具及软装物料`** 下；重命名时**先**在 `植物盆栽/` 找旧文件再 `mv` 到软装目录（可删空 `植物盆栽` 文件夹）。
- **定制中式建筑结构**：类别四位码在 **`category_prefix_map.json`** 中为 **`WD08`**（勿用 ST）。若上轮已把图改成 `ST03-`，而 `materials_raw` 里 `code` 仍是更早旧码，请先把导出 `code` 改成磁盘当前文件名再跑清洗，否则脚本找不到源图。
- 运行后会生成 **`pic_rename_manifest.csv`**，便于核对。
- 网站 `public/assets/PIC` 若为**平铺**无子目录，请加 **`--pic-layout flat`**。

## 数据库

见 `migrations/004_materials_code_migration_runbook.sql`：**DROP FK → UPDATE rule_items → UPDATE materials → UNIQUE + FK**。

## 与 Step 4 报价

编码全局唯一后，算量与运费不再因同码多行 JOIN 膨胀；`rule_items` 与 PIC 文件名需与迁移后的 `code` 一致。
