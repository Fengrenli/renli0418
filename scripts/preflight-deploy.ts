/**
 * 宝塔 / 生产发布前自检：HTTP 探活 + 数据库 + 核心列表接口。
 *
 * 用法（在服务器上或本机，指向已启动的站点）：
 *   PREFLIGHT_BASE=https://你的域名 npx tsx scripts/preflight-deploy.ts
 *   PREFLIGHT_BASE=http://127.0.0.1:3800 npx tsx scripts/preflight-deploy.ts
 */
const base = (process.env.PREFLIGHT_BASE || 'http://127.0.0.1:3800').replace(/\/$/, '');

const TIMEOUT_MS = Math.min(60_000, Math.max(3_000, parseInt(process.env.PREFLIGHT_TIMEOUT_MS || '15000', 10) || 15_000));

async function req(path: string, init?: RequestInit) {
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const res = await fetch(url, {
    ...init,
    signal: ac.signal,
    headers: { Accept: 'application/json', ...((init?.headers as Record<string, string>) || {}) },
  });
  clearTimeout(t);
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text.slice(0, 300) };
  }
  return { res, json };
}

function fail(msg: string) {
  console.error('❌', msg);
  process.exitCode = 1;
}

async function main() {
  console.log('预检目标:', base, '\n');

  // 1) 健康检查（含实时 DB ping + 行数）
  const health = await req('/api/health');
  if (!health.res.ok) {
    fail(`/api/health HTTP ${health.res.status}`);
    return;
  }
  const hd = health.json as {
    success?: boolean;
    data?: {
      liveDbOk?: boolean;
      dbPingMs?: number | null;
      projectsTotal?: number | null;
      materialsTotal?: number | null;
      dbError?: string | null;
    };
  };
  if (!hd.data?.liveDbOk) {
    fail(
      `数据库未连通: ${hd.data?.dbError || 'liveDbOk=false'}（请检查服务器能否访问 RDS、白名单、账号密码）`,
    );
  } else {
    console.log('✅ 数据库连通', {
      dbPingMs: hd.data.dbPingMs,
      projectsTotal: hd.data.projectsTotal,
      materialsTotal: hd.data.materialsTotal,
    });
  }

  // 2) 项目列表（首页/看板数据）
  const proj = await req('/api/projects?limit=5');
  if (!proj.res.ok) {
    fail(`/api/projects HTTP ${proj.res.status}`);
    return;
  }
  const pj = proj.json as { success?: boolean; data?: unknown[] };
  const arr = Array.isArray(pj.data) ? pj.data : [];
  if (pj.success === false) {
    fail('/api/projects 返回 success=false');
    return;
  }
  console.log('✅ /api/projects', { sampleCount: arr.length, note: 'limit=5 仅抽样' });

  // 3) 品牌列表（材料库同源）
  const brands = await req('/api/list-brands');
  if (!brands.res.ok) {
    fail(`/api/list-brands HTTP ${brands.res.status}`);
    return;
  }
  const br = brands.json as { success?: boolean; data?: unknown[] };
  const bl = Array.isArray(br.data) ? br.data : [];
  if (br.success === false) {
    fail('/api/list-brands 返回 success=false');
    return;
  }
  console.log('✅ /api/list-brands', { brandRows: bl.length });

  // 4) 上传目录可达性（HEAD/GET 任意静态；无文件时 404 也正常，只确认路由存在）
  const upAc = new AbortController();
  const upT = setTimeout(() => upAc.abort(), TIMEOUT_MS);
  const up = await fetch(`${base}/uploads/`, { method: 'GET', signal: upAc.signal });
  clearTimeout(upT);
  if (up.status === 404 || up.status === 403 || up.status === 200) {
    console.log('✅ /uploads/ 路由响应', up.status, '（404 表示目录空但 Node 静态已挂载）');
  } else {
    console.warn('⚠️ /uploads/ 意外状态', up.status, '请确认 Nginx 未错误拦截');
  }

  if (process.exitCode === 1) return;

  console.log('\n预检完成。请在浏览器再确认：首页实战数据、项目看板、含 .glb 的详情预览。');
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('abort') || msg.includes('Abort')) {
    console.error(`❌ 请求超时（${TIMEOUT_MS}ms）或站点未启动。请先在本机/服务器运行 npm run start 或 npm run dev，或检查 PREFLIGHT_BASE。`);
  } else {
    console.error('预检异常:', e);
  }
  process.exit(1);
});
