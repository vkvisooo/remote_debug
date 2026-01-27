import { defineConfig } from 'vite';
import { babel } from '@rollup/plugin-babel';

export default defineConfig({
  plugins: [
    babel({
      babelHelpers: 'inline',
      exclude: 'node_modules/**',
      extensions: ['.js'],
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              chrome: '53'
            },
            modules: false, // Let Vite handle modules
            useBuiltIns: false,
            corejs: false
          }
        ]
      ]
    })
  ],
  resolve: {
    // Ensure regenerator-runtime can be resolved
    dedupe: ['regenerator-runtime']
  },
  build: {
    outDir: 'dist/agent',
    // target: 'es5', // Target ES5 for Chrome 50 compatibility
    lib: {
      entry: 'src/index.js',
      name: 'RemoteDebugAgent',
      fileName: 'index',
      formats: ['umd', 'iife'] // Use UMD for immediate execution in browser
    },
    rollupOptions: {
      // Ensure regenerator-runtime is bundled, not external
      external: [],
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

