/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { configDefaults } from 'vitest/config';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  test: {
    // TA-002: los recorridos de Playwright (e2e/) se corren con `npm run test:e2e`, no con Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
