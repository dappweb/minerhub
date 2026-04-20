import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'child_process';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isAI = process.env.DISABLE_HMR === 'true';

  const uploadOrRemoveAPKPlugin = {
    name: 'upload-or-remove-apk',
    async closeBundle() {
      if (mode === 'production') {
        await new Promise((resolve, reject) => {
          const child = spawn('node', ['scripts/build-and-upload-apk.mjs'], {
            cwd: process.cwd(),
            stdio: 'inherit',
          });
          child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Upload script failed with code ${code}`));
          });
          child.on('error', reject);
        });
      }
    },
  };

  return {
    plugins: [react(), tailwindcss(), uploadOrRemoveAPKPlugin],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'motion/react',
        'lucide-react',
        'viem',
      ],
      exclude: ['wrangler'],
    },
    esbuild: {
      target: 'es2022',
      ...(mode === 'production' && {
        drop: ['console', 'debugger'],
      }),
    },
    build: {
      target: 'es2022',
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'blockchain': ['viem'],
            'animation': ['motion'],
            'icons': ['lucide-react'],
          },
        },
      },
      sourcemap: false,
      chunkSizeWarningLimit: 600,
    },
    server: {
      hmr: !isAI,
      watch: isAI
        ? {
            usePolling: true,
            interval: 1000,
            ignored: ['**/node_modules/**', '**/dist/**', '**/backend/**', '**/contracts/**', '**/app-client/**', '**/.git/**'],
          }
        : {
            ignored: ['**/node_modules/**', '**/dist/**', '**/backend/**', '**/contracts/**', '**/app-client/**', '**/.git/**'],
          },
      warmup: {
        clientFiles: [
          './src/App.tsx',
          './src/components/Hero.tsx',
          './src/components/Features.tsx',
          './src/lib/blockchain.ts',
        ],
      },
    },
  };
});