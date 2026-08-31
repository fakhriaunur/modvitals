import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright integration test configuration for ModVitals
 *
 * Integration tests exercise the Hono application as a whole, including
 * health checks, settings validation, and report formatting, without
 * requiring a live Devvit/Redis environment. They use app.request()
 * to test HTTP-level behavior end-to-end.
 *
 * Run: npx playwright test
 * Run UI: npx playwright test --ui
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 10_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'integration',
      testMatch: /.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
