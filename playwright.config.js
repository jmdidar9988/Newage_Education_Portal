import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E & Integration Test Configuration
 * Supports testing against local server or deployed Vercel application.
 */
const BASE_URL = process.env.DEPLOYED_URL || process.env.BASE_URL || 'http://localhost:8080';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45 * 1000,
  expect: {
    timeout: 8000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10 * 1000,
    navigationTimeout: 20 * 1000
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'Desktop Safari',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'Mobile Chrome (Pixel 5)',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'Mobile Safari (iPhone 13)',
      use: { ...devices['iPhone 13'] }
    }
  ],
  webServer: process.env.DEPLOYED_URL ? undefined : {
    command: 'powershell -ExecutionPolicy Bypass -File ./server.ps1 -port 8080',
    url: 'http://localhost:8080/index.html',
    reuseExistingServer: true,
    timeout: 20 * 1000
  }
});
