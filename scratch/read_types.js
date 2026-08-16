import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dtsPath = path.resolve(__dirname, '../node_modules/@remotion/renderer/dist/open-browser.d.ts');
if (fs.existsSync(dtsPath)) {
  const content = fs.readFileSync(dtsPath, 'utf8');
  console.log(content);
} else {
  console.log('d.ts file not found at:', dtsPath);
}
