import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const apiTarget = process.env.VITE_API_PROXY ?? 'http://localhost:8080';
// The Prism mock from shikshit-backend (`make mock`) serves the contract without the /api/v1 prefix.
const useMock = process.env.VITE_API_MOCK === '1';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', '@reduxjs/toolkit', 'react-redux'],
          signalr: ['@microsoft/signalr'],
          bootstrap: ['bootstrap'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        ...(useMock ? { rewrite: (p: string) => p.replace(/^\/api\/v1/, '') } : {}),
      },
      '/hubs': {
        target: apiTarget,
        ws: true,
      },
    },
  },
});