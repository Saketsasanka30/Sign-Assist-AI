import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      headers: {
        // Required for SharedArrayBuffer / WebAssembly threading used by MediaPipe
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    // Ensure MediaPipe WASM files are served with correct MIME type
    assetsInclude: ['**/*.wasm', '**/*.task'],
    optimizeDeps: {
      // Exclude mediapipe from bundling — it loads its WASM files dynamically at runtime
      exclude: ['@mediapipe/tasks-vision'],
    },
    build: {
      // Raise the chunk-size warning threshold to avoid false positives from MediaPipe
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            mediapipe: ['@mediapipe/tasks-vision'],
          },
        },
      },
    },
  };
});
