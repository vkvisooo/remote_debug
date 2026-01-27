import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';


const basePath = process.env.VITE_BASE_PATH || './';

export default defineConfig({
  base: basePath,
  plugins: [react()],
  build: {
    outDir: 'dist/webui',
    // Ensure assets are referenced with correct base path
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // Ensure consistent asset paths
        assetFileNames: 'assets/[name].[hash].[ext]',
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js'
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});

