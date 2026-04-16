// db.js - 阿里云 PQS 数据库连接配置
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');
const envDevPath = path.join(__dirname, '.env.development');

// 在阿里云/PM2/容器里，工作目录可能不是项目根目录；这里用绝对路径保证 .env 能被加载
const dotenvResult = dotenv.config({ path: envPath, override: false });
dotenv.config({ path: envDevPath, override: false });
if (dotenvResult?.error) {
  if (!process.env.DB_HOST && !process.env.DATABASE_URL) {
    console.warn('⚠️  没有找到 .env，且环境变量 DB_HOST / DATABASE_URL 也未设置。');
  }
}

// 兼容 DATABASE_URL（很多云平台/运维会直接提供该变量）
const sslRequested = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1';
const sslRejectUnauthorized = (() => {
  const v = process.env.DB_SSL_REJECT_UNAUTHORIZED;
  if (v === undefined) return false; // 云端证书链/内网证书常见问题：默认不校验
  return v === 'true' || v === '1';
})();

const dbConfig =
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
        ssl: sslRequested ? { rejectUnauthorized: sslRejectUnauthorized } : undefined,
        options: '-c statement_timeout=120000 -c lock_timeout=30000',
      }
    : (() => {
        const host = process.env.DB_HOST || '';
        const user = process.env.DB_USER || '';
        const envPassword = process.env.DB_PASSWORD?.replace(/^"|"$/g, '');
        const password = envPassword && envPassword.length > 0 ? envPassword : '';
        const database = process.env.DB_DATABASE || process.env.DB_NAME || '';
        const port = parseInt(process.env.DB_PORT || '5432', 10);

        const missing = [];
        if (!host) missing.push('DB_HOST');
        if (!user) missing.push('DB_USER');
        if (!password) missing.push('DB_PASSWORD');
        if (!database) missing.push('DB_DATABASE 或 DB_NAME');

        if (missing.length) {
          throw new Error(
            `缺少数据库配置：${missing.join(', ')}。请在项目根目录 .env 中配置（参考 .env.example），勿将密码提交到 Git。`,
          );
        }

        return {
          host,
          user,
          password,
          database,
          port,
          connectionTimeoutMillis: 5000,
          ssl: sslRequested ? { rejectUnauthorized: sslRejectUnauthorized } : undefined,
          options: '-c statement_timeout=120000 -c lock_timeout=30000',
        };
      })();

// 只打印非敏感信息，避免把密码打到日志里
console.log('🗄️  数据库配置:');
console.log('Host:', dbConfig.host ?? '(from DATABASE_URL)');
console.log('User:', dbConfig.user ?? '(from DATABASE_URL)');
console.log('Database:', dbConfig.database ?? '(from DATABASE_URL)');
console.log('Port:', dbConfig.port ?? '(from DATABASE_URL)');
console.log('SSL:', sslRequested ? 'enabled' : 'disabled');

// 创建连接池（PQS 推荐用连接池，避免频繁建联）
const pool = new Pool(dbConfig);

// 测试 PQS 连接（部署后立刻暴露连接失败原因）
async function testPQSConnection() {
  try {
    console.log('🔌 正在测试数据库连接...');
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      console.log('✅ 数据库连接成功');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ 数据库连接失败:', err?.message);
    console.error('错误代码:', err?.code);
    console.error('错误号(errno):', err?.errno);
    console.error('地址信息(address):', err?.address);
    console.error('端口信息(port):', err?.port);
    console.error('错误详情:', err?.stack);
    // 常见错误排查：1. 白名单未加服务器 IP；2. 安全组未放行 5432；3. SSL 要求不一致；4. 密码/库名错误
  }
}

testPQSConnection();

export default pool;