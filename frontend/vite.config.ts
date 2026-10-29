import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import pkg from './package.json';

// Identificacao da publicacao, embutida no bundle e mostrada na tela de
// entrada. APP_COMMIT e APP_PUBLICADO_EM chegam como build args do Docker
// (publicar.ps1 / publicar.sh); sem eles, vale a hora deste build.
const versaoApp = pkg.version;
const commitApp = process.env.APP_COMMIT?.trim() || '';
const publicadoEm = process.env.APP_PUBLICADO_EM?.trim() || new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSAO__: JSON.stringify(versaoApp),
    __APP_COMMIT__: JSON.stringify(commitApp),
    __APP_PUBLICADO_EM__: JSON.stringify(publicadoEm),
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/testes/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/testes/**', 'src/main.tsx'],
    },
  },
});
