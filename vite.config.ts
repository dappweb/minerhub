import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isAI = process.env.DISABLE_HMR === 'true';
  // After build: remove large APK binary from dist/ to stay within
  // Cloudflare Pages 25 MiB single-file limit.
  // APK upload + URL sync now happen in scripts/pre-build.mjs BEFORE vite starts.
  const removeDistApkPlugin = {
    name: 'remove-dist-apk',
    async closeBundle() {
      if (mode !== 'production') return;
      const distApk = path.join(process.cwd(), 'dist/downloads/app-release.apk');
      try {
        const { existsSync, promises: { rm } } = await import('fs');
        if (existsSync(distApk)) {
          await rm(distApk, { force: true });
          console.log('ℹ️  已从 dist 中移除 APK（超出 CF Pages 25 MiB 限制）');
        }
      } catch { /* non-fatal */ }
    },
  };

  return {
    plugins: [react(), tailwindcss(), removeDistApkPlugin],
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