import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, 'uploads');

async function normalize() {
  const result = await pool.query('SELECT id, name, digital_assets FROM projects WHERE digital_assets IS NOT NULL');

  for (const row of result.rows) {
    let assets = row.digital_assets;
    if (typeof assets === 'string') { try { assets = JSON.parse(assets); } catch(e) { continue; } }
    if (!Array.isArray(assets) || assets.length === 0) continue;

    let modified = false;
    const normalized = assets.map(a => {
      const url = a.url || '';
      // 如果 URL 指向 uploads/ 根目录（非项目子目录），移动文件并更新 URL
      const match = url.match(/^\/uploads\/(\d+-\d+-[^/]+)$/);
      if (match) {
        const fileName = match[1];
        const srcPath = path.join(uploadsDir, fileName);
        const projDir = path.join(uploadsDir, row.id);
        const dstPath = path.join(projDir, fileName);

        if (fs.existsSync(srcPath)) {
          if (!fs.existsSync(projDir)) fs.mkdirSync(projDir, { recursive: true });
          if (!fs.existsSync(dstPath)) {
            fs.copyFileSync(srcPath, dstPath);
            console.log(`✅ 复制 ${fileName} → ${row.id}/`);
          }
          modified = true;
          return { ...a, url: `/uploads/${row.id}/${fileName}` };
        }
      }
      return a;
    });

    if (modified) {
      await pool.query('UPDATE projects SET digital_assets = $1::jsonb WHERE id = $2', [JSON.stringify(normalized), row.id]);
      console.log(`📝 更新 ${row.name} (${row.id})`);
    }
  }

  console.log('\n✅ 路径规范化完成');
  await pool.end();
}
normalize();
