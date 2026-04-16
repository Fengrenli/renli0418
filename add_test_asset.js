import pool from './db.js';
(async () => {
  const asset = {
    id: 'asset-new-test-' + Date.now(),
    url: '/uploads/proj-1774851876525/test_asset.txt',
    name: 'test_asset.txt',
    size: '48 B',
    type: 'link',
    uploadDate: new Date().toISOString().split('T')[0]
  };
  try {
    await pool.query(
      `UPDATE projects 
       SET digital_assets = COALESCE(digital_assets, '[]'::jsonb) || $2::jsonb
       WHERE id = $1`,
      ['proj-1774851876525', JSON.stringify([asset])]
    );
    console.log('Database updated successfully');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();