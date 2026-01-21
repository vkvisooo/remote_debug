import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple build script that copies all server files
const srcDir = join(__dirname, 'src');
const distDir = join(__dirname, 'dist', 'server');

function copyRecursive(src, dest) {
  const entries = readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    
    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      copyFileSync(srcPath, destPath);
    }
  }
}

try {
  // Create dist directory
  mkdirSync(distDir, { recursive: true });
  
  // Copy all JS files from src to dist/server
  copyRecursive(srcDir, distDir);
  
  console.error('Server build completed successfully');
  console.error(`Files copied to: ${distDir}`);
} catch (error) {
  console.error('Build error:', error);
  process.exit(1);
}

