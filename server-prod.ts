import express from 'express';
import type { Pool } from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import bcrypt from 'bcrypt';

// 加载环境变量
const __filename_env = fileURLToPath(import.meta.url);
const __dirname_env = path.dirname(__filename_env);
dotenv.config({ path: path.resolve(__dirname_env, '.env'), override: false });
if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV === '1') {
  dotenv.config({ path: path.resolve(__dirname_env, '.env.development'), override: false });
}

// 导入 PostgreSQL 连接池
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== 关键修复：强制使用绝对路径 ==========
const uploadsDir = '/www/wwwroot/renliyesheng/uploads';
console.log('[uploadsDir] 强制使用绝对路径:', uploadsDir);
console.log('[uploadsDir] 目录存在:', fs.existsSync(uploadsDir));

if (!fs.existsSync(uploadsDir)) {
  console.error('[uploadsDir] 错误：目录不存在！');
} else {
  // 列出所有项目目录
  const entries = fs.readdirSync(uploadsDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  console.log('[uploadsDir] 项目目录列表:', dirs);
}
// ================================================

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 工具函数
const formatAssetSize = (size: number | undefined | null) => {
  return Number.isFinite(Number(size)) && Number(size) > 0
    ? `${(Number(size) / 1024 / 1024).toFixed(2)} MB`
    : '--';
};

const buildUploadsUrl = (...segments: string[]) => {
  return `/uploads/${segments.map((seg) => encodeURIComponent(String(seg || '').trim())).filter(Boolean).join('/')}`;
};

const inferAssetTypeFromFileName = (fileName: string): string => {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(glb|gltf|fbx|obj|ifc|dwg|skp|nwd)$/.test(lower)) return 'model';
  if (/\.(jpg|jpeg|png|webp|gif)$/.test(lower)) return 'image';
  if (/\.(mp4|mov|avi|webm)$/.test(lower)) return 'video';
  return 'link';
};

const parseJsonArraySafe = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

// 扫描项目目录中的文件
const listAssetsFromProjectDir = (projectId: string, assetIdPrefix = 'asset-fs') => {
  console.log('[listAssetsFromProjectDir] 扫描项目:', projectId);
  
  const projectDir = path.join(uploadsDir, projectId);
  console.log('[listAssetsFromProjectDir] 项目目录:', projectDir);
  console.log('[listAssetsFromProjectDir] 目录存在:', fs.existsSync(projectDir));
  
  if (!fs.existsSync(projectDir)) {
    console.log('[listAssetsFromProjectDir] 目录不存在，返回空数组');
    return [];
  }

  const nowDate = new Date().toISOString().split('T')[0];

  try {
    const files = fs.readdirSync(projectDir);
    console.log('[listAssetsFromProjectDir] 找到文件数:', files.length);
    
    const result = files
      .map((fileName) => {
        const fullPath = path.join(projectDir, fileName);
        try {
          const stat = fs.statSync(fullPath);
          if (!stat.isFile()) return null;
          return { fileName, stat };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is { fileName: string; stat: fs.Stats } => Boolean(entry))
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
      .map((entry, idx) => ({
        id: `${assetIdPrefix}-${projectId}-${idx}`,
        name: entry.fileName,
        type: inferAssetTypeFromFileName(entry.fileName),
        url: buildUploadsUrl(projectId, entry.fileName),
        size: formatAssetSize(entry.stat.size),
        uploadDate: entry.stat.mtime
          ? new Date(entry.stat.mtime).toISOString().split('T')[0]
          : nowDate,
      }));
    
    console.log('[listAssetsFromProjectDir] 返回资产数:', result.length);
    return result;
  } catch (err) {
    console.error('[listAssetsFromProjectDir] 错误:', err);
    return [];
  }
};

// 统一响应格式
const sendResponse = (res: any, status: number, data: any) => {
  res.status(status).json(data);
};

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const candidateProjectId = 
      req.query.projectId || 
      req.headers['x-project-id'] || 
      'default';
    const projectId = String(candidateProjectId).replace(/[\\/]/g, '_');
    const projectDir = path.join(uploadsDir, projectId);
    
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    cb(null, projectDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueSuffix}-${safeName}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// Serve uploads directory
app.use('/uploads', express.static(uploadsDir));

// 测试接口
app.get('/api/test-uploads-dir', (req, res) => {
  const info = {
    uploadsDir,
    exists: fs.existsSync(uploadsDir),
    projectDirs: [] as string[]
  };
  
  if (fs.existsSync(uploadsDir)) {
    const entries = fs.readdirSync(uploadsDir, { withFileTypes: true });
    info.projectDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  }
  
  sendResponse(res, 200, { code: 200, data: info, success: true });
});

// 获取项目列表
app.get('/api/projects', async (req, res) => {
  console.log('[projects] GET /api/projects requested');
  
  try {
    const result = await pool.query(`
      SELECT 
        id, name, client_name, brand_id, project_type, area, location, city, country,
        coordinates, status, description, progress, stages, digital_assets,
        image_url, feishu_dept_id, team_members, feishu_excluded_member_ids, created_at
      FROM projects
      ORDER BY created_at DESC
      LIMIT 300
    `);

    const mapped = result.rows.map(row => {
      // 优先使用数据库中的 digital_assets，如果没有则扫描目录
      let digitalAssets = parseJsonArraySafe(row.digital_assets);
      
      if (digitalAssets.length === 0) {
        console.log(`[projects] 项目 ${row.name} (${row.id}) 数据库为空，扫描目录...`);
        digitalAssets = listAssetsFromProjectDir(String(row.id || ''), 'fs');
        console.log(`[projects] 项目 ${row.name} 扫描结果:`, digitalAssets.length, '个文件');
      }
      
      return {
        id: row.id,
        name: row.name,
        clientName: row.client_name,
        brandId: row.brand_id,
        projectType: row.project_type,
        area: row.area,
        location: row.location,
        city: row.city,
        country: row.country,
        coordinates: row.coordinates,
        status: row.status,
        description: row.description,
        progress: row.progress,
        stages: parseJsonArraySafe(row.stages),
        digitalAssets,
        teamMembers: parseJsonArraySafe(row.team_members),
        feishuExcludedMemberIds: parseJsonArraySafe(row.feishu_excluded_member_ids),
        imageUrl: row.image_url,
        feishuDeptId: row.feishu_dept_id,
        createdAt: row.created_at
      };
    });

    console.log('[projects] 返回项目数:', mapped.length);
    sendResponse(res, 200, { code: 200, msg: 'success', data: mapped, success: true });
  } catch (error: any) {
    console.error('[projects] ERROR:', error?.message || error);
    sendResponse(res, 500, { code: 500, msg: '服务器内部错误：' + error.message, success: false });
  }
});

// 文件上传接口
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return sendResponse(res, 400, { code: 400, msg: 'No file uploaded', success: false });
  }

  const candidateProjectId = 
    req.query.projectId || 
    req.headers['x-project-id'] || 
    'default';
  const projectId = String(candidateProjectId).replace(/[\\/]/g, '_');
  
  const relativePath = path.relative(uploadsDir, req.file.path).split(path.sep).join('/');
  const encodedRelativePath = relativePath
    .split('/')
    .map(seg => encodeURIComponent(seg))
    .join('/');
  const fileUrl = `/uploads/${encodedRelativePath}`;
  
  const assetEntry = {
    id: `asset-${Date.now()}`,
    name: req.file.originalname,
    type: inferAssetTypeFromFileName(req.file.originalname || ''),
    url: fileUrl,
    size: formatAssetSize(req.file.size),
    uploadDate: new Date().toISOString().split('T')[0],
  };

  // 同步到数据库
  if (projectId !== 'default') {
    await pool.query(
      `UPDATE projects 
       SET digital_assets = COALESCE(digital_assets, '[]'::jsonb) || jsonb_build_array($2::jsonb)
       WHERE id = $1`,
      [projectId, JSON.stringify(assetEntry)]
    ).catch(e => console.warn('[upload] 数据库同步失败:', e.message));
  }
  
  sendResponse(res, 200, { 
    code: 200, 
    msg: 'Upload success', 
    data: { url: fileUrl, asset: assetEntry },
    success: true 
  });
});

// 启动服务器
const PORT = process.env.SERVER_PORT || 3800;
app.listen(PORT, () => {
  console.log(`✅ 服务器已启动，监听端口: ${PORT}`);
  console.log(`📁 uploadsDir: ${uploadsDir}`);
});
