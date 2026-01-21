import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist/agent',
    lib: {
      entry: 'src/index.js',
      name: 'RemoteDebugAgent',
      fileName: 'index',
      formats: ['umd', 'iife'] // Use UMD for immediate execution in browser
    },
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        format: 'umd',
        name: 'RemoteDebugAgent',
        // Ensure code executes immediately
        banner: '/* Remote Debug Agent - Auto-executing */',
        footer: '/* End Remote Debug Agent */'
      }
    },
    minify: false, // Disable minification for debugging
    sourcemap: true
  }
});

