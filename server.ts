// SERVER VERSION: 2026-04-09-001 - WITH SAVE API
import express from 'express';
import type { Pool } from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

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

// ========== uploads 目录配置 ==========
// 使用环境变量或自动检测，确保在本地和服务器都能正常工作
const uploadsDir = (() => {
  // 1. 优先使用环境变量
  if (process.env.UPLOADS_DIR && fs.existsSync(process.env.UPLOADS_DIR)) {
    return process.env.UPLOADS_DIR;
  }
  
  // 2. 使用相对于工作目录的 uploads
  const cwdUploads = path.join(process.cwd(), 'uploads');
  if (fs.existsSync(cwdUploads)) {
    return cwdUploads;
  }
  
  // 3. 使用相对于脚本目录的 uploads
  const scriptDirUploads = path.join(__dirname, 'uploads');
  if (fs.existsSync(scriptDirUploads)) {
    return scriptDirUploads;
  }
  
  // 4. 默认使用工作目录并创建
  return cwdUploads;
})();

console.log('[uploadsDir] 使用路径:', uploadsDir);

if (!fs.existsSync(uploadsDir)) {
  console.log('[uploadsDir] 创建目录:', uploadsDir);
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 列出所有项目目录
const entries = fs.readdirSync(uploadsDir, { withFileTypes: true });
const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
console.log('[uploadsDir] 项目目录列表:', dirs);
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

const parseJsonArraySafe = (value: any, context = ''): any[] => {
  // 调试日志
  if (context) {
    console.log(`[parseJsonArraySafe] ${context} - 输入值:`, value);
    console.log(`[parseJsonArraySafe] ${context} - 类型:`, typeof value);
    console.log(`[parseJsonArraySafe] ${context} - 是否是数组:`, Array.isArray(value));
  }
  
  if (Array.isArray(value)) {
    if (context) console.log(`[parseJsonArraySafe] ${context} - 返回数组，长度:`, value.length);
    return value;
  }
  
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      const result = Array.isArray(parsed) ? parsed : [];
      if (context) console.log(`[parseJsonArraySafe] ${context} - 解析字符串，返回长度:`, result.length);
      return result;
    } catch {
      if (context) console.log(`[parseJsonArraySafe] ${context} - 解析失败，返回空数组`);
      return [];
    }
  }
  
  if (context) console.log(`[parseJsonArraySafe] ${context} - 未知类型，返回空数组`);
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
      .map((entry, idx) => {
        // 磁盘文件名格式为 "1713000000000-123456789-原始文件名.ext"，去除时间戳前缀还原可读名
        const displayName = entry.fileName.replace(/^\d+-\d+-/, '');
        return {
        id: `${assetIdPrefix}-${projectId}-${idx}`,
        name: displayName || entry.fileName,
        type: inferAssetTypeFromFileName(entry.fileName),
        url: buildUploadsUrl(projectId, entry.fileName),
        size: formatAssetSize(entry.stat.size),
        uploadDate: entry.stat.mtime
          ? new Date(entry.stat.mtime).toISOString().split('T')[0]
          : nowDate,
      }; });
    
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

// 修复 multer 文件名编码：浏览器发送 UTF-8，multer 按 latin1 解析，需要手动转回
const fixMulterEncoding = (name: string): string => {
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
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
    // 修复编码后再生成安全文件名，保留中文/日文/韩文等 Unicode 字符
    const decodedName = fixMulterEncoding(file.originalname);
    const safeName = decodedName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    cb(null, `${uniqueSuffix}-${safeName}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

// Serve static files from dist directory (frontend build)
app.use(express.static(path.join(__dirname, 'dist')));

// Serve uploads directory
app.use('/uploads', express.static(uploadsDir));

// 健康检查接口
app.get('/api/health', (_req, res) => {
  res.json({ code: 200, msg: 'server is running', timestamp: Date.now() });
});

// 微信公众号校验接口 (GET)
app.get('/api/wechat', (req, res) => {
  const { signature, timestamp, nonce, echostr } = req.query;
  const token = process.env.WECHAT_TOKEN || 'renli_accio_2026';

  if (!signature || !timestamp || !nonce) {
    return res.status(400).send('Bad Request');
  }

  const list = [token, timestamp as string, nonce as string].sort();
  const sha1 = crypto.createHash('sha1');
  sha1.update(list.join(''));
  const hash = sha1.digest('hex');

  if (hash === signature) {
    res.send(echostr);
  } else {
    res.status(403).send('Invalid signature');
  }
});

// 微信消息接收接口 (POST)
// 注意：微信推送的是 XML 格式，我们使用 express.text 进行中间件处理
app.post('/api/wechat', express.text({ type: ['text/xml', 'application/xml'] }), (req: any, res) => {
  const xmlData = req.body;
  if (!xmlData || typeof xmlData !== 'string') {
    return res.send('success');
  }

  // 提取 FromUserName, ToUserName, Content, MsgType
  const fromUser = xmlData.match(/<FromUserName><!\[CDATA\[(.*?)\]\]><\/FromUserName>/)?.[1];
  const toUser = xmlData.match(/<ToUserName><!\[CDATA\[(.*?)\]\]><\/ToUserName>/)?.[1];
  const content = xmlData.match(/<Content><!\[CDATA\[(.*?)\]\]><\/Content>/)?.[1];
  const msgType = xmlData.match(/<MsgType><!\[CDATA\[(.*?)\]\]><\/MsgType>/)?.[1];

  console.log(`[WeChat] Received msgType: ${msgType}, fromUser: ${fromUser}, content: ${content}`);

  if (msgType === 'text' && content) {
    const inboxPath = path.resolve(__dirname, process.env.WECHAT_INBOX_PATH || 'wechat_inbox.jsonl');
    const entry = JSON.stringify({
      fromUser,
      content,
      timestamp: new Date().toISOString(),
      status: 'pending'
    }) + '\n';
    
    try {
      fs.appendFileSync(inboxPath, entry);
      
      // 回复用户
      const replyXml = `
        <xml>
          <ToUserName><![CDATA[${fromUser}]]></ToUserName>
          <FromUserName><![CDATA[${toUser}]]></FromUserName>
          <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
          <MsgType><![CDATA[text]]></MsgType>
          <Content><![CDATA[【Accio 助手】已收到指令：\n"${content}"\n\n我正在后台为你安排优化任务，请稍后查看 Dashboard。]]></Content>
        </xml>
      `.trim();
      res.set('Content-Type', 'text/xml');
      res.send(replyXml);
    } catch (err) {
      console.error('[WeChat] Failed to write inbox:', err);
      res.send('success');
    }
  } else {
    // 对于非文本消息（如关注事件、图片等），直接返回 success
    res.send('success');
  }
});

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

// 获取项目列表 (豆包方案：确保读取并解析所有缺失字段)
app.get('/api/projects', async (req, res) => {
  try {
    console.log('[API /api/projects] 开始获取项目列表');
    const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC LIMIT 500');
    console.log('[API /api/projects] 查询到项目数:', result.rowCount);

    const projects = result.rows.map(row => {
      const parseJson = (f: any) => {
        if (!f) return [];
        if (typeof f === 'string') { try { return JSON.parse(f); } catch(e) { return []; } }
        return Array.isArray(f) ? f : [];
      };

      return {
        id: row.id,
        name: row.name || '',
        clientName: row.client_name || '',
        projectType: row.project_type || '',
        area: row.area || '',
        location: row.location || '',
        city: row.city || '',
        country: row.country || '',
        coordinates: parseJson(row.coordinates),
        status: row.status || '待启动',
        description: row.description || '',
        imageUrl: row.image_url || '',
        brandId: row.brand_id || '',
        feishuDeptId: row.feishu_dept_id || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        digitalAssets: parseJson(row.digital_assets),
        stages: parseJson(row.stages),
        teamMembers: parseJson(row.team_members),
        feishuExcludedMemberIds: parseJson(row.feishu_excluded_member_ids),
        progress: Number(row.progress || 0)
      };
    });

    console.log('[API /api/projects] 返回项目数:', projects.length);
    console.log('[API /api/projects] 第一个项目 digitalAssets:', projects[0]?.digitalAssets?.length || 0);

    return res.json({
      code: 200,
      success: true,
      data: projects,
      msg: 'ok'
    });
  } catch (err) {
    console.error('项目列表接口错误', err);
    return res.status(500).json({ success: false, msg: '服务器错误' });
  }
});

// 获取单个项目 (支持刷新后从接口读取真实数据)
app.get('/api/project/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    console.log('[API /api/project/:id] 请求项目:', id);
    const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, msg: '项目不存在' });
    }
    
    const row = result.rows[0];
    
    const parseJson = (f: any) => {
      if (!f) return [];
      if (typeof f === 'string') { try { return JSON.parse(f); } catch(e) { return []; } }
      return Array.isArray(f) ? f : [];
    };

    // 🚀 核心改进：彻底清理对象，只保留驼峰命名，消除歧义
    const project = {
      id: row.id,
      name: row.name || '',
      clientName: row.client_name || '',
      projectType: row.project_type || '',
      area: row.area || '',
      location: row.location || '',
      city: row.city || '',
      country: row.country || '',
      coordinates: parseJson(row.coordinates),
      imageUrl: row.image_url || '',
      description: row.description || '',
      feishuDeptId: row.feishu_dept_id || '',
      feishuExcludedMemberIds: parseJson(row.feishu_excluded_member_ids),
      digitalAssets: parseJson(row.digital_assets),
      stages: parseJson(row.stages),
      teamMembers: parseJson(row.team_members),
      status: row.status || '待启动',
      progress: Number(row.progress || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    return res.json({
      code: 200,
      success: true,
      data: project
    });
  } catch (err) {
    console.error('获取单个项目错误', err);
    return res.status(500).json({ success: false, msg: '服务器错误' });
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
  
  const decodedOriginalName = fixMulterEncoding(req.file.originalname);
  const assetEntry = {
    id: `asset-${Date.now()}`,
    name: decodedOriginalName,
    type: inferAssetTypeFromFileName(decodedOriginalName || ''),
    url: fileUrl,
    size: formatAssetSize(req.file.size),
    uploadDate: new Date().toISOString().split('T')[0],
  };

  // 同步到数据库
  if (projectId !== 'default') {
    try {
      console.log('[upload] 同步文件到数据库, projectId:', projectId);
      console.log('[upload] assetEntry:', JSON.stringify(assetEntry));
      
      const result = await pool.query(
        `UPDATE projects 
         SET digital_assets = COALESCE(digital_assets, '[]'::jsonb) || $2::jsonb
         WHERE id = $1
         RETURNING digital_assets`,
        [projectId, JSON.stringify([assetEntry])]
      );
      
      const updatedAssets = result.rows[0]?.digital_assets || [];
      console.log('[upload] 数据库同步成功, 更新后资产总数:', Array.isArray(updatedAssets) ? updatedAssets.length : 0);
      
      return sendResponse(res, 200, { 
        code: 200, 
        msg: 'Upload success', 
        data: { url: fileUrl, asset: assetEntry, digitalAssets: updatedAssets },
        success: true 
      });
    } catch (e: any) {
      console.error('[upload] 数据库同步失败:', e.message);
      return sendResponse(res, 500, { code: 500, msg: 'Database sync failed', success: false });
    }
  }
  
  sendResponse(res, 200, { 
    code: 200, 
    msg: 'Upload success (no project sync)', 
    data: { url: fileUrl, asset: assetEntry },
    success: true 
  });
});

// 🚀 修复 2：后端保存接口 (豆包方案：确保这些字段 100% 写入数据库)
app.post('/api/save-project-detailed', async (req, res) => {
  console.log('[API /api/save-project-detailed] 收到保存请求');
  
  try {
    const project = req.body;
    console.log('[API /api/save-project-detailed] 项目ID:', project?.id);
    console.log('[API /api/save-project-detailed] digitalAssets 数量:', project?.digitalAssets?.length || 0);
    console.log('[API /api/save-project-detailed] teamMembers 数量:', project?.teamMembers?.length || 0);
    
    if (!project || !project.id) {
      console.error('[API /api/save-project-detailed] 错误: 项目ID缺失');
      return res.status(400).json({ success: false, msg: '项目ID缺失' });
    }

    // 🚀 核心改进：严谨处理 JSON 字段及其命名格式 (Camel vs Snake)
    const getVal = (p: any, camel: string, snake: string) => p[camel] !== undefined ? p[camel] : p[snake];
    const getJson = (p: any, camel: string, snake: string) => {
      const val = getVal(p, camel, snake);
      if (val === undefined || val === null) return '[]';
      return JSON.stringify(Array.isArray(val) ? val : []);
    };

    const progress = Number(getVal(project, 'progress', 'progress') ?? 0);
    const stages = getJson(project, 'stages', 'stages');
    const teamMembers = getJson(project, 'teamMembers', 'team_members');
    const digitalAssets = getJson(project, 'digitalAssets', 'digital_assets');
    const feishuExcluded = getJson(project, 'feishuExcludedMemberIds', 'feishu_excluded_member_ids');
    
    const name = project.name || '';
    const clientName = project.clientName || project.client_name || '';
    const projectType = project.projectType || project.project_type || '';
    const area = project.area || '';
    const location = project.location || '';
    const city = project.city || '';
    const country = project.country || '';
    const status = project.status || '待启动';
    const description = project.description || '';
    const feishuDeptId = project.feishuDeptId || project.feishu_dept_id || '';

    console.log(`[API /api/save-project-detailed] 项目ID: ${project.id}, 准备写入 DB: assets=${digitalAssets.length}, members=${teamMembers.length}`);

    // 100% 写入所有关键字段
    const queryResult = await pool.query(
      `UPDATE projects
       SET progress = $1,
           stages = $2::jsonb,
           team_members = $3::jsonb,
           digital_assets = $4::jsonb,
           name = $5,
           client_name = $6,
           project_type = $7,
           area = $8,
           location = $9,
           city = $10,
           country = $11,
           status = $12,
           description = $13,
           feishu_dept_id = $14,
           feishu_excluded_member_ids = $15::jsonb,
           updated_at = NOW()
       WHERE id = $16
       RETURNING id`,
      [
        progress, stages, teamMembers, digitalAssets,
        name, clientName, projectType, area, location,
        city, country, status, description, feishuDeptId,
        feishuExcluded, project.id
      ]
    );
    
    console.log('[API /api/save-project-detailed] 更新行数:', queryResult.rowCount);

    if (queryResult.rowCount === 0) {
      console.error('[API /api/save-project-detailed] 错误: 未找到项目', project.id);
      return res.status(404).json({ success: false, msg: '项目不存在' });
    }

    console.log('[API /api/save-project-detailed] 保存成功');
    return res.json({ success: true, msg: '保存成功' });
  } catch (err: any) {
    console.error('[API /api/save-project-detailed] 保存项目详细信息失败:', err);
    console.error('[API /api/save-project-detailed] 错误详情:', err.message);
    console.error('[API /api/save-project-detailed] 错误代码:', err.code);
    return res.status(500).json({ success: false, msg: err.message, code: err.code });
  }
});

// 飞书 API 路由
// 获取 tenant_access_token
async function getFeishuToken(): Promise<string | null> {
  try {
    const appId = process.env.FEISHU_APP_ID;
    const appSecret = process.env.FEISHU_APP_SECRET;
    
    if (!appId || !appSecret) {
      console.error('[Feishu] 配置缺失');
      return null;
    }
    
    const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });
    
    const data = await res.json();
    if (data.code !== 0) {
      console.error('[Feishu] 获取 Token 失败:', data.msg);
      return null;
    }
    
    return data.tenant_access_token;
  } catch (err: any) {
    console.error('[Feishu] 获取 Token 错误:', err.message);
    return null;
  }
}

// 获取飞书用户列表 (支持分页，自动处理可见范围限制)
app.get('/api/feishu-members-all', async (req, res) => {
  try {
    console.log('[API /api/feishu-members-all] 开始获取飞书用户列表');
    
    const token = await getFeishuToken();
    if (!token) {
      return res.status(500).json({ success: false, msg: '飞书配置错误' });
    }
    
    // 1. 获取应用可见范围
    const scopeRes = await fetch('https://open.feishu.cn/open-apis/contact/v3/scopes', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const scopeData = await scopeRes.json();
    
    let deptsToFetch = ['0']; // 默认尝试根部门
    if (scopeData.code === 0 && scopeData.data?.department_ids) {
      const authorizedDepts = scopeData.data.department_ids;
      if (authorizedDepts.length > 0) {
        deptsToFetch = authorizedDepts;
        console.log('[Feishu] 检测到应用权限受限于以下部门:', deptsToFetch);
      }
    }

    let allUsers: any[] = [];
    const seenUserIds = new Set();
    
    // 2. 遍历所有可见部门获取用户
    for (const deptId of deptsToFetch) {
      let pageToken = '';
      let hasMore = true;
      
      while (hasMore) {
        // 使用 fetch_child=true 获取部门及其子部门的所有用户
        const url = `https://open.feishu.cn/open-apis/contact/v3/users?page_size=50&department_id_type=open_department_id&department_id=${encodeURIComponent(deptId)}&fetch_child=true${pageToken ? `&page_token=${pageToken}` : ''}`;
        const usersRes = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        const usersData = await usersRes.json();
        if (usersData.code !== 0) {
          console.error(`[Feishu] 获取部门 ${deptId} 用户列表部分失败:`, usersData.msg);
          break;
        }
        
        const items = usersData.data?.items || [];
        for (const u of items) {
          if (!seenUserIds.has(u.user_id)) {
            seenUserIds.add(u.user_id);
            allUsers.push(u);
          }
        }
        
        hasMore = usersData.data?.has_more || false;
        pageToken = usersData.data?.page_token || '';
        
        if (allUsers.length > 2000) break;
      }
      if (allUsers.length > 2000) break;
    }
    
    console.log('[Feishu] 总计获取到唯一用户数量:', allUsers.length);
    
    return res.json({
      code: 200,
      success: true,
      data: allUsers.map((u: any) => ({
        userId: u.user_id,
        name: u.name,
        jobTitle: u.job_title,
        departmentId: u.department_ids?.[0],
        avatar: u.avatar?.avatar_72 || u.avatar?.avatar_origin,
        email: u.email,
        mobile: u.mobile,
      })),
    });
  } catch (err: any) {
    console.error('[API /api/feishu-members-all] 错误:', err.message);
    return res.status(500).json({ success: false, msg: err.message });
  }
});

// 根据部门获取飞书成员 (支持分页)
app.get('/api/feishu-members-by-dept', async (req, res) => {
  try {
    const { departmentId } = req.query;
    console.log('[API /api/feishu-members-by-dept] 部门ID:', departmentId);
    
    const token = await getFeishuToken();
    if (!token) {
      return res.status(500).json({ success: false, msg: '飞书配置错误' });
    }
    
    const deptId = departmentId || '0';
    let allUsers: any[] = [];
    let pageToken = '';
    let hasMore = true;
    
    while (hasMore) {
      const url = `https://open.feishu.cn/open-apis/contact/v3/users?page_size=50&department_id_type=open_department_id&department_id=${encodeURIComponent(String(deptId))}${pageToken ? `&page_token=${pageToken}` : ''}`;
      const usersRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      const usersData = await usersRes.json();
      console.log(`[Feishu] 响应 (${url}):`, JSON.stringify(usersData, null, 2).substring(0, 2000));
      if (usersData.code !== 0) {
        console.error('[Feishu] 获取部门用户部分失败:', usersData.msg);
        break;
      }
      
      const items = usersData.data?.items || [];
      allUsers = [...allUsers, ...items];
      
      hasMore = usersData.data?.has_more || false;
      pageToken = usersData.data?.page_token || '';
      
      if (allUsers.length > 1000) break;
    }
    
    console.log('[Feishu] 部门计获取到用户数量:', allUsers.length);
    
    return res.json({
      code: 200,
      success: true,
      data: allUsers.map((u: any) => ({
        userId: u.user_id,
        name: u.name,
        jobTitle: u.job_title,
        departmentId: u.department_ids?.[0],
        avatar: u.avatar?.avatar_72 || u.avatar?.avatar_origin,
        email: u.email,
        mobile: u.mobile,
      })),
      sourceDepartmentId: departmentId || '0',
    });
  } catch (err: any) {
    console.error('[API /api/feishu-members-by-dept] 错误:', err.message);
    return res.status(500).json({ success: false, msg: err.message });
  }
});

// 获取飞书组织架构 (支持分页)
app.get('/api/feishu-org-tree', async (req, res) => {
  try {
    console.log('[API /api/feishu-org-tree] 获取组织架构');
    
    const token = await getFeishuToken();
    if (!token) {
      return res.status(500).json({ success: false, msg: '飞书配置错误' });
    }
    
    let allDepts: any[] = [];
    let pageToken = '';
    let hasMore = true;
    
    while (hasMore) {
      const url = `https://open.feishu.cn/open-apis/contact/v3/departments?page_size=50${pageToken ? `&page_token=${pageToken}` : ''}`;
      const deptsRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      const deptsData = await deptsRes.json();
      if (deptsData.code !== 0) {
        console.error('[Feishu] 获取部门列表部分失败:', deptsData.msg);
        break;
      }
      
      const items = deptsData.data?.items || [];
      allDepts = [...allDepts, ...items];
      
      hasMore = deptsData.data?.has_more || false;
      pageToken = deptsData.data?.page_token || '';
      
      if (allDepts.length > 500) break;
    }
    
    return res.json({
      code: 200,
      success: true,
      data: allDepts.map((d: any) => ({
        id: d.open_department_id,
        name: d.name,
        parentId: d.parent_department_id,
        memberCount: d.member_count,
      })),
    });
  } catch (err: any) {
    console.error('[API /api/feishu-org-tree] 错误:', err.message);
    return res.status(500).json({ success: false, msg: err.message });
  }
});

// 管理后台 API
// 获取商机线索列表
app.get('/api/list-campaign', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM campaign_application ORDER BY create_time DESC');
    return res.json({ code: 200, success: true, data: result.rows });
  } catch (err: any) {
    console.error('获取线索列表错误', err);
    return res.status(500).json({ success: false, msg: '服务器错误' });
  }
});

// 更新商机线索状态
app.post('/api/update-campaign-status', async (req, res) => {
  try {
    const { id, status } = req.body;
    await pool.query('UPDATE campaign_application SET status = $1 WHERE id = $2', [status, id]);
    return res.json({ code: 200, success: true, msg: '更新成功' });
  } catch (err: any) {
    console.error('更新线索状态错误', err);
    return res.status(500).json({ success: false, msg: '服务器错误' });
  }
});

// 删除商机线索
app.post('/api/delete-campaign', async (req, res) => {
  try {
    const { id } = req.body;
    await pool.query('DELETE FROM campaign_application WHERE id = $1', [id]);
    return res.json({ code: 200, success: true, msg: '删除成功' });
  } catch (err: any) {
    console.error('删除线索错误', err);
    return res.status(500).json({ success: false, msg: '服务器错误' });
  }
});

// 用户登录
app.post('/api/login', async (req, res) => {
  console.log('[API /api/login] 登录请求:', req.body?.username);
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      console.log('[API /api/login] 缺少参数');
      return res.status(400).json({ success: false, msg: '缺少用户名或密码', code: 400 });
    }

    console.log('[API /api/login] 正在查询用户:', username);
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rowCount === 0) {
      console.log('[API /api/login] 用户不存在:', username);
      return res.status(401).json({ success: false, msg: '用户不存在', code: 401 });
    }
    
    const user = result.rows[0];
    console.log('[API /api/login] 正在比对密码...');
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      console.log('[API /api/login] 密码错误:', username);
      return res.status(401).json({ success: false, msg: '密码错误', code: 401 });
    }
    
    console.log('[API /api/login] 登录成功:', username);
    return res.json({
      code: 200,
      success: true,
      username: user.username,
      role: user.role,
      brand_id: user.brand_id,
      brand_name: user.brand_name
    });
  } catch (err: any) {
    console.error('[API /api/login] 异常:', err);
    return res.status(500).json({ success: false, msg: '服务器错误' });
  }
});

// 用户注册
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const existing = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (existing.rowCount && existing.rowCount > 0) {
      return res.status(400).json({ success: false, msg: '用户名已存在', code: 400 });
    }
    
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password, role, status) VALUES ($1, $2, $3, $4)',
      [username, hashed, 'guest', 'active']
    );
    
    return res.json({
      code: 200,
      success: true,
      username,
      role: 'guest',
      msg: '注册成功'
    });
  } catch (err: any) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, msg: '服务器错误' });
  }
});

// 获取品牌列表
app.get('/api/list-brands', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM brands ORDER BY name ASC');
    return res.json({ code: 200, success: true, data: result.rows });
  } catch (err: any) {
    console.error('获取品牌列表错误', err);
    return res.status(500).json({ success: false, msg: err.message });
  }
});

// 保存/更新品牌
app.post('/api/save-brand', async (req, res) => {
  try {
    const { id, name, logo, description, website, category, established, location, status, sort_order } = req.body;
    
    if (id) {
      await pool.query(
        'UPDATE brands SET name=$1, logo=$2, description=$3, website=$4, category=$5, established=$6, location=$7, status=$8, sort_order=$9, updated_at=NOW() WHERE id=$10',
        [name, logo, description, website, category, established, location, status, sort_order, id]
      );
    } else {
      await pool.query(
        'INSERT INTO brands (name, logo, description, website, category, established, location, status, sort_order, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())',
        [name, logo, description, website, category, established, location, status, sort_order]
      );
    }
    return res.json({ code: 200, success: true, msg: '保存成功' });
  } catch (err: any) {
    console.error('保存品牌错误', err);
    return res.status(500).json({ success: false, msg: err.message });
  }
});

// 删除品牌
app.post('/api/delete-brand', async (req, res) => {
  try {
    const { id } = req.body;
    await pool.query('DELETE FROM brands WHERE id = $1', [id]);
    return res.json({ code: 200, success: true, msg: '删除成功' });
  } catch (err: any) {
    console.error('删除品牌错误', err);
    return res.status(500).json({ success: false, msg: '服务器错误' });
  }
});

// 保存/更新用户
app.post('/api/save-user', async (req, res) => {
  try {
    const { username, password, role, brand_id, status } = req.body;
    
    // 检查用户是否存在
    const existing = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (existing.rowCount && existing.rowCount > 0) {
      // 更新
      let query = 'UPDATE users SET role = $1, brand_id = $2, status = $3';
      let params = [role, brand_id, status, username];
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        query += ', password = $4 WHERE username = $5';
        params = [role, brand_id, status, hashedPassword, username];
      } else {
        query += ' WHERE username = $4';
      }
      await pool.query(query, params);
    } else {
      // 新建
      const hashedPassword = await bcrypt.hash(password || '123456', 10);
      await pool.query(
        'INSERT INTO users (username, password, role, brand_id, status) VALUES ($1, $2, $3, $4, $5)',
        [username, hashedPassword, role, brand_id, status || 'active']
      );
    }
    
    return res.json({ code: 200, success: true, msg: '保存成功' });
  } catch (err: any) {
    console.error('保存用户错误', err);
    return res.status(500).json({ success: false, msg: err.message });
  }
});

// 删除用户
app.post('/api/delete-user', async (req, res) => {
  try {
    const { username } = req.body;
    if (username === 'admin') return res.status(400).json({ success: false, msg: '不能删除超级管理员' });
    await pool.query('DELETE FROM users WHERE username = $1', [username]);
    return res.json({ code: 200, success: true, msg: '删除成功' });
  } catch (err: any) {
    console.error('删除用户错误', err);
    return res.status(500).json({ success: false, msg: '服务器错误' });
  }
});

// 删除项目
app.post('/api/delete-project', async (req, res) => {
  try {
    const { id } = req.body;
    await pool.query('DELETE FROM projects WHERE id = $1', [id]);
    return res.json({ code: 200, success: true, msg: '项目已删除' });
  } catch (err: any) {
    console.error('删除项目错误', err);
    return res.status(500).json({ success: false, msg: '服务器错误' });
  }
});

// =====================================================
// 缺失 API 补全 (2026-04-10 全面审计后一次性添加)
// =====================================================

// GET /api/list-users (管理后台 - 权限管理)
app.get('/api/list-users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, brand_id, status, create_time FROM users ORDER BY id ASC');
    return res.json({ code: 200, success: true, data: result.rows });
  } catch (err: any) {
    console.error('[API /api/list-users] 错误:', err.message);
    return res.status(500).json({ code: 500, success: false, msg: err.message });
  }
});

// V1 接口兼容性别名
app.get(['/api/v1/list-materials', '/api/list-materials'], async (req, res) => {
  try {
    const { restaurant_brand_id } = req.query;
    let query = 'SELECT m.*, b.name as restaurant_brand_name FROM materials m LEFT JOIN brands b ON m.restaurant_brand_id = b.id';
    const params: any[] = [];

    if (restaurant_brand_id && restaurant_brand_id !== '全部') {
      query += ' WHERE m.restaurant_brand_id = $1';
      params.push(restaurant_brand_id);
    }

    query += ' ORDER BY m.code ASC';
    const result = await pool.query(query, params);
    console.log(`[API /api/list-materials] 返回 ${result.rows.length} 条材料`);
    return res.json({ code: 200, success: true, data: result.rows });
  } catch (err: any) {
    console.error('[API /api/list-materials] 错误:', err.message);
    return res.status(500).json({ code: 500, success: false, msg: err.message });
  }
});

// POST /api/save-material (BOM 保存/更新材料)
app.post('/api/save-material', async (req, res) => {
  try {
    const m = req.body;
    const existing = await pool.query('SELECT id FROM materials WHERE code = $1', [m.code]);

    if (existing.rowCount && existing.rowCount > 0) {
      await pool.query(
        `UPDATE materials SET name=$1, price=$2, unit=$3, category=$4, brand=$5, 
         hs_code=$6, weight=$7, volume=$8, image=$9, restaurant_brand_id=$10,
         material_brand=$11, spec=$12, description=$13
         WHERE code=$14`,
        [m.name, m.price, m.unit, m.category, m.brand, m.hs_code, m.weight, m.volume,
         m.image, m.restaurant_brand_id, m.material_brand, m.spec, m.description, m.code]
      );
    } else {
      await pool.query(
        `INSERT INTO materials (code, name, price, unit, category, brand, hs_code, weight, volume, image, restaurant_brand_id, material_brand, spec, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [m.code, m.name, m.price, m.unit, m.category, m.brand, m.hs_code, m.weight, m.volume,
         m.image, m.restaurant_brand_id, m.material_brand, m.spec, m.description]
      );
    }
    return res.json({ code: 200, success: true, msg: '材料保存成功' });
  } catch (err: any) {
    console.error('[API /api/save-material] 错误:', err.message);
    return res.status(500).json({ code: 500, success: false, msg: err.message });
  }
});

// POST /api/geocode/resolve (地理编码 - 解析地址为坐标)
app.post('/api/geocode/resolve', async (req, res) => {
  try {
    const { name, location } = req.body;
    const query = encodeURIComponent(`${name || ''} ${location || ''}`);
    
    // 尝试高德地图 API（国内优先）
    const amapKey = process.env.AMAP_API_KEY;
    if (amapKey) {
      try {
        const amapUrl = `https://restapi.amap.com/v3/geocode/geo?key=${amapKey}&address=${query}`;
        const amapRes = await fetch(amapUrl);
        const amapData = await amapRes.json();
        if (amapData.status === '1' && amapData.geocodes && amapData.geocodes.length > 0) {
          const loc = amapData.geocodes[0].location.split(',');
          return res.json({
            success: true,
            data: {
              best: { lat: parseFloat(loc[1]), lon: parseFloat(loc[0]) },
              display_name: amapData.geocodes[0].formatted_address
            }
          });
        }
      } catch (amapErr: any) {
        console.warn('[geocode] 高德 API 失败，尝试 Nominatim:', amapErr.message);
      }
    }

    // 回退到 Nominatim (OpenStreetMap)
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;
      const response = await fetch(nominatimUrl, {
        headers: { 'User-Agent': 'RenliYesheng/1.0' },
        signal: AbortSignal.timeout(10000) // 10 秒超时
      });
      const data = await response.json();
      
      if (data && data.length > 0) {
        return res.json({
          success: true,
          data: {
            best: { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) },
            display_name: data[0].display_name
          }
        });
      }
    } catch (nomErr: any) {
      console.warn('[geocode] Nominatim 也失败:', nomErr.message);
    }
    
    return res.json({ success: false, msg: '未找到地理位置' });
  } catch (err: any) {
    console.error('[API /api/geocode/resolve] 错误:', err.message);
    // 返回 200 + success:false，而不是 500，避免前端报错
    return res.json({ success: false, msg: err.message || '地理编码服务暂不可用' });
  }
});

// GET /api/geocode/search (地理编码 - 搜索建议)
app.get('/api/geocode/search', async (req, res) => {
  try {
    const { q, limit } = req.query;
    const query = encodeURIComponent(String(q || ''));
    const maxResults = Number(limit) || 6;
    
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=${maxResults}`;
    const response = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'RenliYesheng/1.0' }
    });
    const data = await response.json();
    
    return res.json({
      success: true,
      data: (data || []).map((item: any) => ({
        display_name: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: item.type
      }))
    });
  } catch (err: any) {
    console.error('[API /api/geocode/search] 错误:', err.message);
    return res.status(500).json({ success: false, msg: err.message });
  }
});

// POST /api/get-project (BOM 快照 - 获取项目 BOM 数据)
app.post('/api/get-project', async (req, res) => {
  try {
    const { project_id } = req.body;
    if (!project_id) return res.status(400).json({ code: 400, msg: '缺少 project_id' });
    
    const result = await pool.query('SELECT * FROM projects WHERE id = $1', [project_id]);
    if (result.rowCount === 0) {
      return res.json({ code: 404, msg: '项目不存在' });
    }
    
    const row = result.rows[0];
    return res.json({
      code: 0,
      data: {
        project: {
          id: row.id,
          name: row.name,
          clientName: row.client_name,
          projectType: row.project_type,
        },
        items: [] // BOM items 暂无独立表，返回空
      }
    });
  } catch (err: any) {
    console.error('[API /api/get-project] 错误:', err.message);
    return res.status(500).json({ code: 500, msg: err.message });
  }
});

// POST /api/save-project (BOM 快照 - 保存 BOM 项目数据)
app.post('/api/save-project', async (req, res) => {
  try {
    const projectData = req.body;
    // 复用 save-project-detailed 逻辑
    if (projectData.id) {
      await pool.query(
        `UPDATE projects SET name=$1, client_name=$2, updated_at=NOW() WHERE id=$3`,
        [projectData.name, projectData.clientName || projectData.client_name, projectData.id]
      );
    }
    return res.json({ code: 0, success: true, msg: '保存成功' });
  } catch (err: any) {
    console.error('[API /api/save-project] 错误:', err.message);
    return res.status(500).json({ code: 500, msg: err.message });
  }
});

// POST /api/seed-materials (管理后台 - 初始化/重置材料库)
app.post('/api/seed-materials', async (req, res) => {
  try {
    console.log('[API /api/seed-materials] 开始初始化材料库...');
    // 从 products 表同步到 materials 表
    const syncResult = await pool.query(`
      INSERT INTO materials (code, name, description, price, unit, category, brand, hs_code, weight, volume, image, create_time)
      SELECT code, name, description, 
             COALESCE(NULLIF(price, '')::numeric, 0), 
             unit, category, brand, hs_code, 
             COALESCE(NULLIF(weight, '')::numeric, 0),
             COALESCE(NULLIF(volume, '')::numeric, 0),
             image, NOW()
      FROM products
      WHERE code IS NOT NULL AND code != ''
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        unit = EXCLUDED.unit,
        category = EXCLUDED.category,
        brand = EXCLUDED.brand,
        hs_code = EXCLUDED.hs_code,
        weight = EXCLUDED.weight,
        volume = EXCLUDED.volume,
        image = EXCLUDED.image
    `);
    console.log(`[API /api/seed-materials] 同步完成，影响行数: ${syncResult.rowCount}`);
    return res.json({ code: 200, success: true, msg: `材料库初始化完成，同步了 ${syncResult.rowCount} 条记录` });
  } catch (err: any) {
    console.error('[API /api/seed-materials] 错误:', err.message);
    return res.status(500).json({ code: 500, success: false, msg: err.message });
  }
});

// POST /api/ai/suggest-hscode (AI 建议 HS 编码)
app.post('/api/ai/suggest-hscode', async (req, res) => {
  try {
    const { productName } = req.body;
    // 简单的 HS Code 建议逻辑（基于关键词）
    const hsMap: Record<string, string> = {
      '瓦': '6905.10',
      '砖': '6904.10',
      '灯': '9405.42',
      '龙头': '8481.80',
      '管': '7306.30',
      '板': '6907.21',
      '石材': '6802.93',
      '木': '4418.75',
    };
    
    let suggestedCode = '6905.10'; // 默认建材类
    for (const [keyword, code] of Object.entries(hsMap)) {
      if (productName && productName.includes(keyword)) {
        suggestedCode = code;
        break;
      }
    }
    
    return res.json({ 
      code: 200, 
      success: true, 
      data: { hsCode: suggestedCode, confidence: 0.75 } 
    });
  } catch (err: any) {
    console.error('[API /api/ai/suggest-hscode] 错误:', err.message);
    return res.status(500).json({ code: 500, success: false, msg: err.message });
  }
});

// =====================================================
// BOM 算量引擎 API (Sprint 1)
// =====================================================

/**
 * POST /api/bom/calculate
 * 单体 SKU 算量：根据 SKU 编码 + 测量尺寸，计算该 SKU 的用量和造价
 * 
 * Body: { sku_code, measured_area?, measured_length?, quantity?, waste_rate? }
 * 返回: { success, data: { sku_code, name, unit, unit_price, raw_qty, waste_rate, final_qty, total_price, calc_mode } }
 */
app.post('/api/bom/calculate', async (req, res) => {
  try {
    const { sku_code, measured_area, measured_length, quantity, waste_rate } = req.body;
    
    if (!sku_code) {
      return res.status(400).json({ success: false, msg: '缺少 sku_code' });
    }

    // 查询材料信息
    const matResult = await pool.query(
      'SELECT code, name, price, unit, category, suggested_waste_rate FROM materials WHERE code = $1 LIMIT 1',
      [sku_code]
    );
    
    if (matResult.rowCount === 0) {
      return res.status(404).json({ success: false, msg: `材料 ${sku_code} 不存在` });
    }

    const mat = matResult.rows[0];
    const unitPrice = Number(mat.price) || 0;
    const defaultWaste = Number(mat.suggested_waste_rate) || 0.10; // 默认 10% 损耗
    const actualWaste = waste_rate !== undefined ? Number(waste_rate) : defaultWaste;

    let rawQty = 0;
    let calcMode = 'unknown';

    // 查询该 SKU 是否有关联的 assembly rule，获取 base_quantity_per_unit
    const ruleResult = await pool.query(
      `SELECT ri.base_quantity_per_unit, ri.label, ar.unit as rule_unit, ar.code as rule_code
       FROM rule_items ri 
       JOIN assembly_rules ar ON ri.assembly_rule_id = ar.id
       WHERE ri.material_code = $1`,
      [sku_code]
    );

    if (ruleResult.rowCount > 0) {
      const rule = ruleResult.rows[0];
      const baseQty = Number(rule.base_quantity_per_unit);

      if (rule.rule_unit === 'linear_meter' && measured_length) {
        // 延米计算：长度 × 每延米用量
        rawQty = Number(measured_length) * baseQty;
        calcMode = 'linear_meter';
      } else if (rule.rule_unit === 'sqm' && measured_area) {
        // 面积铺贴：面积 × 每平方米用量
        rawQty = Number(measured_area) * baseQty;
        calcMode = 'area';
      } else if (quantity) {
        rawQty = Number(quantity);
        calcMode = 'manual';
      } else {
        // 有规则但没传对应尺寸，用默认 1 单位
        rawQty = baseQty;
        calcMode = 'rule_default';
      }
    } else {
      // 无规则关联，直接按数量
      rawQty = Number(quantity) || 1;
      calcMode = 'quantity';
    }

    // 应用损耗率并向上取整
    const finalQty = Math.ceil(rawQty * (1 + actualWaste));
    const totalPrice = Math.round(finalQty * unitPrice * 100) / 100;

    return res.json({
      success: true,
      data: {
        sku_code: mat.code,
        name: mat.name,
        unit: mat.unit,
        category: mat.category,
        unit_price: unitPrice,
        raw_qty: Math.round(rawQty * 100) / 100,
        waste_rate: actualWaste,
        final_qty: finalQty,
        total_price: totalPrice,
        calc_mode: calcMode,
      }
    });
  } catch (err: any) {
    console.error('[API /api/bom/calculate] 错误:', err.message);
    return res.status(500).json({ success: false, msg: err.message });
  }
});

/**
 * POST /api/bom/calculate-scene
 * 场景批量算量：接收 Pascal 导出的场景构件数组，按 assembly_rule 分组汇总计算
 * 
 * 同时支持 V1 别名: /api/v1/calculate-bom
 * 
 * Body: { 
 *   scene: [{ sku: "BR99-GYHG-ABETH-001", area?: number, length?: number, quantity?: number }],
 *   waste_rate?: number,  // 全局损耗率覆盖
 *   assembly_code?: string  // 指定使用哪个 assembly (eaves_standard / wall_hybrid)
 * }
 * 
 * 返回: { success, data: { summary, groups: [{ group_name, items, subtotal }] } }
 */
app.post(['/api/bom/calculate-scene', '/api/v1/calculate-bom'], async (req, res) => {
  console.log('[API BOM Calculate] Body received:', JSON.stringify(req.body).substring(0, 500) + (JSON.stringify(req.body).length > 500 ? '...' : ''));
  
  try {
    let { scene, scenario_code, value, waste_rate, assembly_code } = req.body;
    
    // 如果是 JSON 字符串则解析
    if (typeof scene === 'string') {
      try { scene = JSON.parse(scene); } catch(e) { console.error('[API Calculate] Failed to parse scene string:', e.message); }
    }

    // 1. 处理场景化套餐算量 (V1 风格，用于 EngineeringAssistantModal)
    if (scenario_code) {
      const inputValue = Number(value || 0);
      const scenarioWaste = waste_rate !== undefined ? Number(waste_rate) : 0.10;
      
      const eavesRules = [
        { cands: ['BR99-GYHG-ABETH-001', 'ABETH-002', 'ABETH-001', 'CE01-GYHG-ABETH-002'], qtyPerM: 25, name: '筒瓦', label: '筒瓦 片/延米' },
        { cands: ['BR99-GYHG-X8D5-001', 'ABDET-001', 'CE01-GYHG-ABDET-001'], qtyPerM: 35, name: '板瓦', label: '板瓦 片/延米' },
        { cands: ['BR99-GYHG-ABHRG-001', 'ABHRG-002', 'ABHRG-001', 'CE01-GYHG-ABHRG-002', 'CE01-GYHG-ABHRG-001'], qtyPerM: 2, name: '正脊', label: '正脊 套/延米' },
        { cands: ['BR99-GYHG-ABTIE-001', 'ABTIE-001', 'CE01-GYHG-ABTIE-001'], qtyPerM: 1.5, name: '滴水', label: '滴水 套/延米' },
        { cands: ['BR99-GYHG-ABRAF-001', 'ABRAF-001', 'CE01-GYHG-ABRAF-001'], qtyPerM: 1.5, name: '挡沟', label: '挡沟 套/延米' },
      ];
      
      const wallRules = [
        { cands: ['BR99-GYHG-ABMRR-002', 'ABCEC-002', 'CE01-GYHG-ABCEC-002'], factor: (v: number) => v * (1 / 0.702) * 0.95, waste: 0.03, name: '预制墙板', label: '预制墙板 块/㎡（主材 · 95% 面积）' },
        { cands: ['BR99-GYHG-ABMRR-001', 'ABMRR-001', 'CE01-GYHG-ABMRR-001'], factor: (v: number) => v * 80 * 0.05, waste: 0.375, name: '青砖片', label: '青砖片 片/㎡（收口 · 5% 面积）' },
      ];
      
      let lines: any[] = [];
      let totalWeight = 0;
      let totalVolume = 0;
      let totalPrice = 0;
      
      const targetRules = scenario_code === 'eaves' ? eavesRules : (scenario_code === 'wall_hybrid' ? wallRules : []);
      const allSkus = targetRules.flatMap(r => r.cands);
      
      const matResult = await pool.query(
        'SELECT code, name, price, unit, weight, volume, category, image FROM materials WHERE code = ANY($1)',
        [allSkus]
      );
      const matMap = new Map();
      matResult.rows.forEach(m => matMap.set(m.code, m));
      
      for (const rule of targetRules) {
        const sku = rule.cands.find(c => matMap.has(c)) || rule.cands[0];
        const mat = matMap.get(sku);
        
        let standardQty = 0;
        if (scenario_code === 'eaves') {
          standardQty = inputValue * (rule as any).qtyPerM;
        } else {
          standardQty = (rule as any).factor(inputValue);
        }
        
        const lineWaste = (rule as any).waste !== undefined ? (rule as any).waste : scenarioWaste;
        const finalQty = Math.ceil(standardQty * (1 + lineWaste));
        const unitPrice = Number(mat?.price || 0);
        const weight = Number(mat?.weight || 0);
        const volume = Number(mat?.volume || 0);
        
        lines.push({
          code: sku,
          name: mat?.name || rule.name,
          standardQty,
          wasteRate: lineWaste,
          finalOrderQty: finalQty,
          unitPrice,
          linePrice: finalQty * unitPrice,
          weightEach: weight,
          volumeEach: volume,
          lineWeight: finalQty * weight,
          lineVolume: finalQty * volume,
          imageRef: mat?.image ? (mat.image.startsWith('http') || mat.image.startsWith('/uploads') ? mat.image : `/uploads/default/${mat.image}`) : `/assets/PIC/${sku}.png`,
          ruleItemLabel: rule.label,
          highBrickWasteWarning: sku.includes('ABMRR') ? { message: '散砖大面积铺贴：高损耗与人工预警' } : null
        });
        
        totalPrice += finalQty * unitPrice;
        totalWeight += finalQty * weight;
        totalVolume += finalQty * volume;
      }
      
      return res.json({
        success: true,
        data: {
          scenario_name: scenario_code === 'eaves' ? '中式屋檐系统' : '混合墙面系统',
          scenario_unit: scenario_code === 'eaves' ? '延米' : '㎡',
          inputValue,
          lines,
          totals: {
            totalWeight: Math.round(totalWeight * 100) / 100,
            totalVolume: Math.round(totalVolume * 100) / 100,
            totalPrice: Math.round(totalPrice * 100) / 100
          }
        }
      });
    }

    // 2. 处理 3D 场景化算量 (V2 风格，用于 EngineeringDecisionCenter)
    if (!scene || !Array.isArray(scene)) {
      console.warn('[API Calculate] Missing scene array in body:', req.body);
      return res.status(400).json({ success: false, msg: '缺少 scene 数组' });
    }

    // 1. 获取所有 assembly rules 及其 items
    let rulesQuery = `
      SELECT ar.id, ar.code as rule_code, ar.name as rule_name, ar.unit as rule_unit,
             ri.material_code, ri.base_quantity_per_unit, ri.label, ri.sort_order
      FROM assembly_rules ar
      JOIN rule_items ri ON ri.assembly_rule_id = ar.id
      WHERE ar.is_active = true
    `;
    const rulesParams: any[] = [];
    if (assembly_code) {
      rulesQuery += ' AND ar.code = $1';
      rulesParams.push(assembly_code);
    }
    rulesQuery += ' ORDER BY ar.sort_order, ri.sort_order';

    const rulesResult = await pool.query(rulesQuery, rulesParams);

    // 2. 构建 SKU → rule 映射
    const skuRuleMap = new Map();
    for (const r of rulesResult.rows) {
      skuRuleMap.set(r.material_code, {
        ruleCode: r.rule_code,
        ruleName: r.rule_name,
        ruleUnit: r.rule_unit,
        baseQty: Number(r.base_quantity_per_unit),
        label: r.label,
      });
    }

    // 3. 获取场景中所有 SKU 的材料信息
    const allSkus = [...new Set(scene.map((s: any) => s.sku))];
    const matResult = await pool.query(
      'SELECT code, name, price, unit, category, image, image_data, restaurant_brand_name FROM materials WHERE code = ANY($1)',
      [allSkus]
    );
    const matMap = new Map();
    for (const m of matResult.rows) {
      matMap.set(m.code, m);
    }

    // 4. 汇总相同 SKU 的尺寸
    const skuAggregation = new Map();
    for (const node of scene) {
      const sku = node.sku;
      if (!skuAggregation.has(sku)) {
        skuAggregation.set(sku, { totalArea: 0, totalLength: 0, totalQty: 0 });
      }
      const agg = skuAggregation.get(sku);
      agg.totalArea += Number(node.area || 0);
      agg.totalLength += Number(node.length || 0);
      agg.totalQty += Number(node.quantity || 1);
    }

    // 5. 逐 SKU 计算
    const globalWaste = waste_rate !== undefined ? Number(waste_rate) : 0.10;
    const groupMap = new Map(); // rule_code → { name, items[], subtotal }
    let grandTotal = 0;
    let grandQty = 0;
    const unmatchedItems: any[] = [];

    for (const [sku, agg] of skuAggregation) {
      const mat = matMap.get(sku);
      if (!mat) {
        unmatchedItems.push({ sku, reason: '材料不存在' });
        continue;
      }

      const rule = skuRuleMap.get(sku);
      const unitPrice = Number(mat.price) || 0;
      let rawQty = 0;
      let calcMode = 'quantity';

      if (rule) {
        if (rule.ruleUnit === 'linear_meter' && agg.totalLength > 0) {
          rawQty = agg.totalLength * rule.baseQty;
          calcMode = 'linear_meter';
        } else if (rule.ruleUnit === 'sqm' && agg.totalArea > 0) {
          rawQty = agg.totalArea * rule.baseQty;
          calcMode = 'area';
        } else {
          rawQty = agg.totalQty * rule.baseQty;
          calcMode = 'rule_qty';
        }
      } else {
        rawQty = agg.totalQty;
        calcMode = 'manual';
      }

      const finalQty = Math.ceil(rawQty * (1 + globalWaste));
      const totalPrice = Math.round(finalQty * unitPrice * 100) / 100;

      // 分组
      const groupKey = rule ? rule.ruleCode : mat.category || '其他';
      const groupName = rule ? rule.ruleName : (mat.category || '其他材料');

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, { group_name: groupName, group_code: groupKey, items: [], subtotal: 0 });
      }
      const group = groupMap.get(groupKey);
      group.items.push({
        sku_code: sku,
        name: mat.name,
        unit: mat.unit,
        category: mat.category,
        image: mat.image ? (mat.image.startsWith('http') || mat.image.startsWith('/uploads') ? mat.image : `/uploads/default/${mat.image}`) : `/assets/PIC/${sku}.png`,
        label: rule?.label || mat.name,
        unit_price: unitPrice,
        raw_qty: Math.round(rawQty * 100) / 100,
        final_qty: finalQty,
        total_price: totalPrice,
        calc_mode: calcMode,
        measured: { area: agg.totalArea, length: agg.totalLength, quantity: agg.totalQty },
      });
      group.subtotal = Math.round((group.subtotal + totalPrice) * 100) / 100;
      grandTotal += totalPrice;
      grandQty += finalQty;
    }

    return res.json({
      success: true,
      data: {
        summary: {
          total_price: Math.round(grandTotal * 100) / 100,
          total_items: grandQty,
          total_skus: skuAggregation.size,
          waste_rate: globalWaste,
        },
        groups: Array.from(groupMap.values()).sort((a, b) => {
          const order = ['eaves_standard', 'wall_hybrid'];
          return (order.indexOf(a.group_code) === -1 ? 99 : order.indexOf(a.group_code))
               - (order.indexOf(b.group_code) === -1 ? 99 : order.indexOf(b.group_code));
        }),
        unmatched: unmatchedItems.length > 0 ? unmatchedItems : undefined,
      }
    });
  } catch (err: any) {
    console.error('[API /api/bom/calculate-scene] 错误:', err.message);
    return res.status(500).json({ success: false, msg: err.message });
  }
});

/**
 * GET /api/bom/rules
 * 获取所有启用的算量规则及其包含的材料清单（供前端渲染规则配置界面）
 */
app.get('/api/bom/rules', async (req, res) => {
  try {
    const rulesResult = await pool.query(`
      SELECT ar.id, ar.code, ar.name, ar.unit, ar.description, ar.sort_order,
             json_agg(json_build_object(
               'material_code', ri.material_code,
               'base_quantity_per_unit', ri.base_quantity_per_unit,
               'label', ri.label,
               'sort_order', ri.sort_order
             ) ORDER BY ri.sort_order) as items
      FROM assembly_rules ar
      LEFT JOIN rule_items ri ON ri.assembly_rule_id = ar.id
      WHERE ar.is_active = true
      GROUP BY ar.id, ar.code, ar.name, ar.unit, ar.description, ar.sort_order
      ORDER BY ar.sort_order
    `);

    return res.json({
      success: true,
      data: rulesResult.rows,
    });
  } catch (err: any) {
    console.error('[API /api/bom/rules] 错误:', err.message);
    return res.status(500).json({ success: false, msg: err.message });
  }
});

// SPA fallback：所有非 /api/ 的 GET 请求返回 index.html（必须在所有 API 路由之后）
// 注意：Express 5 (path-to-regexp v8) 要求通配符使用 {*path} 语法，不能用裸 *
app.get('{*path}', (req, res, next) => {
  // 如果是 API 请求，说明没有匹配到任何路由，返回 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ code: 404, msg: 'API route not found', path: req.path });
  }
  // 否则返回前端 SPA
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.status(404).send('index.html not found');
});

// 启动服务器
const PORT = process.env.SERVER_PORT || 3800;
const server = app.listen(PORT, () => {
  console.log(`✅ 服务器已启动，监听端口: ${PORT}`);
  console.log(`📁 uploadsDir: ${uploadsDir}`);
  console.log(`📋 已注册的路由数: ${app._router?.stack?.filter((r: any) => r.route)?.length || 'unknown'}`);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ 端口 ${PORT} 已被占用！请先执行: fuser -k ${PORT}/tcp`);
  } else {
    console.error('❌ 服务器启动错误:', err);
  }
  process.exit(1);
});
