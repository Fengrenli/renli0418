import pool from './db.js';

async function fixDb() {
  try {
    // 1. Add status column to campaign_application
    await pool.query("ALTER TABLE campaign_application ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'");
    console.log('✅ Added status column to campaign_application');
    
    // 2. Add status, create_time, brand_id, brand_name to users (if they don't exist)
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS create_time TIMESTAMP DEFAULT NOW()");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS brand_id TEXT");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS brand_name TEXT");
    console.log('✅ Ensured columns in users table');
    
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

fixDb();
