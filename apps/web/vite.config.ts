import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '0.0.0.0', port: 5173, strictPort: false, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 350,
    rolldownOptions: {
      output: {
        codeSplitting: {
          maxSize: 300_000,
          groups: [
            { name: 'vendor-react', test: /[\\/]node_modules[\\/](?:react|react-dom|scheduler)[\\/]/, priority: 100 },
            { name: 'vendor-router', test: /[\\/]node_modules[\\/](?:react-router|react-router-dom|@remix-run[\\/]router)[\\/]/, priority: 90 },
            { name: 'vendor-query', test: /[\\/]node_modules[\\/]@tanstack[\\/]/, priority: 80 },
            { name: 'vendor-motion', test: /[\\/]node_modules[\\/](?:framer-motion|motion-dom|motion-utils)[\\/]/, priority: 70 },
            { name: 'vendor-realtime', test: /[\\/]node_modules[\\/](?:socket\.io-client|socket\.io-parser|engine\.io-client|engine\.io-parser|@socket\.io[\\/]component-emitter)[\\/]/, priority: 60 },
            { name: 'vendor-http', test: /[\\/]node_modules[\\/](?:axios|follow-redirects|proxy-from-env)[\\/]/, priority: 50 },
            { name: 'vendor-ui-state', test: /[\\/]node_modules[\\/](?:zustand|class-variance-authority|clsx|tailwind-merge)[\\/]/, priority: 40 },
            { name: 'vendor-misc', test: /[\\/]node_modules[\\/]/, priority: 0 },
          ],
        },
      },
    },
  },
});
