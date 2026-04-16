// Script to clean materials based on material_img_urls.csv
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

// Extract material codes from CSV
const lines = csvContent.split('\n');
const realMaterials = [];

for (let i = 1; i < lines.length; i++) { // Skip header
  const line = lines[i].trim();
  if (line) {
    const parts = line.split(',');
    if (parts.length > 0) {
      const code = parts[0].trim();
      if (code) {
        realMaterials.push(code);
      }
    }
  }
}

console.log('Found', realMaterials.length, 'real materials from CSV');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function cleanMaterials() {
  try {
    if (realMaterials.length === 0) {
      console.error('No real materials found in CSV');
      return;
    }

    // Create placeholders for SQL query
    const placeholders = realMaterials.map((_, i) => `$${i + 1}`).join(',');
    const query = `DELETE FROM materials WHERE code NOT IN (${placeholders})`;
    
    // Execute the query
    const result = await pool.query(query, realMaterials);
    console.log('Deleted virtual materials:', result.rowCount);
    
    // Get remaining materials count
    const countResult = await pool.query('SELECT COUNT(*) FROM materials');
    console.log('Remaining materials count:', countResult.rows[0].count);
    
  } catch (error) {
    console.error('Error cleaning materials:', error);
  } finally {
    await pool.end();
  }
}

// Run the cleanup
cleanMaterials();
