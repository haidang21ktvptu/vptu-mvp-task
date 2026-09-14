// Smoke test sau khi phát hành production (deploy-prod.yml): mở bản live trên GitHub Pages, đăng nhập
// đúng 1 tài khoản, vào được app rồi đăng xuất. Không build, không dọn dữ liệu, không cần service_role.
// Biến môi trường: SMOKE_URL (mặc định bản live), SMOKE_USERNAME, SMOKE_PASSWORD.
import { defineConfig } from '@playwright/test';
import { DESKTOP } from './lib/devices.mjs';

export default defineConfig({
  testDir: './smoke',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-smoke' }]],
  use: {
    ...DESKTOP,
    baseURL: process.env.SMOKE_URL || 'https://haidang21ktvptu.github.io/vptu-mvp-task/',
    locale: 'vi-VN',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
