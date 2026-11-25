import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  return {
    // Relative base ensures asset URLs resolve properly on GitHub Pages subpaths and Vercel root
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    // Ensure MediaPipe WASM files and tasks are treated as assets
    assetsInclude: ['**/*.wasm', '**/*.task'],
    optimizeDeps: {
      // MediaPipe loads its WASM runtime dynamically
      exclude: ['@mediapipe/tasks-vision'],
    },
    build: {
      chunkSizeWarningLimit: 2500,
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
