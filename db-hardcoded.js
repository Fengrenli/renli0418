/**
 * @deprecated 请改用 `./db.js`（从 .env / DATABASE_URL 读取，不在仓库中存放密码）。
 * 保留此文件仅为兼容旧 import，行为与 db.js 一致。
 */
console.warn('⚠️  db-hardcoded.js 已弃用，请改为 import pool from "./db.js"');
export { default } from './db.js';
