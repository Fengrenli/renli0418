// Script to import materials from material_img_urls.csv
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;

// Read CSV file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.join(__dirname, 'material_img_urls.csv');
const csvContent = fs.readFileSync(csvPath, 'utf8');

// Extract material data from CSV
const lines = csvContent.split('\n');
const materials = [];

for (let i = 1; i < lines.length; i++) { // Skip header
  const line = lines[i].trim();
  if (line) {
    const parts = line.split(',');
    if (parts.length >= 4) {
      const code = parts[0].trim();
      const name = parts[1].trim();
      const image = parts[3].trim();
      
      if (code && name) {
        materials.push({ code, name, image });
      }
    }
  }
}

console.log('Found', materials.length, 'materials to import');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function importMaterials() {
  try {
    // First, delete all existing materials
    await pool.query('DELETE FROM materials');
    console.log('Deleted all existing materials');

    // Import materials from CSV
    for (const material of materials) {
      await pool.query(
        'INSERT INTO materials (code, name, image, description, price, create_time) VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, image = EXCLUDED.image, description = EXCLUDED.description, price = EXCLUDED.price',
        [material.code, material.name, material.image, '', 0]
      );
    }

    console.log('Imported', materials.length, 'materials from CSV');

    // Get final materials count
    const countResult = await pool.query('SELECT COUNT(*) FROM materials');
    console.log('Final materials count:', countResult.rows[0].count);

  } catch (error) {
    console.error('Error importing materials:', error);
  } finally {
    await pool.end();
  }
}

// Run the import
importMaterials();
