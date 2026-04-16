-- DMS 导入 materials_cleaned_for_rds_v*.csv 前执行（CSV 含 pic_folder 列）
-- PostgreSQL / 阿里云 RDS

ALTER TABLE materials ADD COLUMN IF NOT EXISTS pic_folder TEXT;

COMMENT ON COLUMN materials.pic_folder IS '与 OSS materials/<pic_folder>/ 及 Excel 分表文件夹同名，供图片路径与筛选';
