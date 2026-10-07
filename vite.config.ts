/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
  version: string;
};

// Definido pelo Tauri CLI quando o app roda em outro dispositivo (não usado no desktop local).
const tauriDevHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  // Apenas variáveis VITE_* e TAURI_ENV_* chegam ao frontend.
  // Segredos (OPENAI_API_KEY, *_CLIENT_SECRET) nunca devem usar o prefixo VITE_.
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: tauriDevHost ?? false,
    hmr: tauriDevHost ? { protocol: 'ws', host: tauriDevHost, port: 1421 } : undefined,
    watch: {
      ignored: ['**/src-tauri/target/**', '**/src-tauri/gen/**'],
    },
  },
  optimizeDeps: {
    // Recomendação oficial do pacote: o wasm precisa ser servido sem pré-bundle.
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  build: {
    // WebView2 (Windows) é Chromium evergreen.
    target: 'chrome120',
    // O bundle é carregado do disco pelo app desktop (sem rede): ~600 kB não é problema.
    chunkSizeWarningLimit: 1000,
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
});
