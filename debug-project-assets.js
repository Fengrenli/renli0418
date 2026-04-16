import pool from './db.js';

async function checkProject(id) {
  try {
    const result = await pool.query('SELECT id, name, digital_assets FROM projects WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      console.log('Project not found');
      return;
    }
    const row = result.rows[0];
    console.log('ID:', row.id);
    console.log('Name:', row.name);
    console.log('digital_assets (raw):', row.digital_assets);
    console.log('Type of digital_assets:', typeof row.digital_assets);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

const id = process.argv[2] || 'proj-1775203736057';
checkProject(id);
