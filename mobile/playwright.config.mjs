import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/e2e', timeout: 90000, workers: 1,
  use: { baseURL: 'http://localhost:8081', viewport: { width: 390, height: 844 }, headless: true },
  webServer: { command: 'npx expo start --port 8081 --localhost', url: 'http://localhost:8081', reuseExistingServer: true, timeout: 120000 },
});
