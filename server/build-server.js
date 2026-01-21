import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple build script that copies and prepares the server
const srcDir = join(__dirname, 'src');
const distDir = join(__dirname, 'dist', 'server');

try {
  mkdirSync(distDir, { recursive: true });
  
  // Copy main file
  const mainContent = readFileSync(join(srcDir, 'index.js'), 'utf-8');
  writeFileSync(join(distDir, 'index.js'), mainContent);
  
  console.error('Server build completed successfully');
} catch (error) {
  console.error('Build error:', error);
  process.exit(1);
}

