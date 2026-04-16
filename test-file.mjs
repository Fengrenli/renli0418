import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, 'server.ts');
console.log('Server file path:', serverPath);
console.log('File exists:', fs.existsSync(serverPath));

if (fs.existsSync(serverPath)) {
  const content = fs.readFileSync(serverPath, 'utf-8');
  console.log('File size:', content.length);
  console.log('First 100 chars:', content.substring(0, 100));
  console.log('Contains save-project-detailed:', content.includes('save-project-detailed'));
}
