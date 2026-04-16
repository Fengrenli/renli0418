import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const hmrPort = parseInt(env.VITE_HMR_PORT || process.env.VITE_HMR_PORT || '24679', 10);
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: { port: hmrPort },
      },
      plugins: [react()],
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom'],
              'vendor-utils': ['lucide-react', 'framer-motion', 'd3', 'topojson-client'],
              'vendor-excel': ['xlsx', 'exceljs'],
            }
          }
        },
        chunkSizeWarningLimit: 1000,
      },
      /** 勿将服务端密钥注入浏览器；通义等仅通过 /api/* 调用 */
      define: {
        global: 'window',
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.')
        }
      }
    };
});
