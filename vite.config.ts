import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isAI = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    // Pre-bundle heavy dependencies so dev server starts faster
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

    // Modern target for faster transforms
    esbuild: {
      target: 'es2022',
      ...(mode === 'production' && {
        drop: ['console', 'debugger'],
      }),
    },

    build: {
      target: 'es2022',
      minify: 'esbuild',
      // Split large vendor chunks for better caching
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
      // HMR disabled in AI Studio via DISABLE_HMR env var
      hmr: !isAI,
      // Optimized file watching: ignore irrelevant directories
      watch: isAI
        ? {
            // Polling mode with slower interval reduces CPU during AI agent edits
            usePolling: true,
            interval: 1000,
            ignored: ['**/node_modules/**', '**/dist/**', '**/backend/**', '**/contracts/**', '**/app-client/**', '**/.git/**'],
          }
        : {
            ignored: ['**/node_modules/**', '**/dist/**', '**/backend/**', '**/contracts/**', '**/app-client/**', '**/.git/**'],
          },
      // Pre-transform frequently used modules for faster page loads
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
