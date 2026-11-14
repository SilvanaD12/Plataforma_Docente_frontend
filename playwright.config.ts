import { defineConfig, devices } from '@playwright/test';

/**
 * TA-002: recorridos del navegador con Playwright, sin backend real (las respuestas de la API se simulan con
 * page.route a partir de docs/api/openapi.json del backend).
 *
 * - PLAYWRIGHT_BASE_URL apunta a otra instancia del frontend; si no se define, se levanta el servidor de Vite.
 * - El servidor de Vite de las pruebas usa su propio puerto, para no reutilizar un `npm run dev` abierto con otro
 *   código (por ejemplo, de otra rama).
 * - Solo Chromium.
 */
const port = Number(process.env.PLAYWRIGHT_PORT ?? 5199);
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseUrl ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `npm run dev -- --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
