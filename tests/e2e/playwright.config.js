// Playwright chạy trên bản build Vite (vite preview) trỏ tới staging; 2 kích thước màn hình
// (1280px máy tính, 360px điện thoại — SPEC NF-4). Chạy tuần tự vì dữ liệu dùng chung.
import { defineConfig, devices } from '@playwright/test';
import { getKeys } from './lib/keys.mjs';

const keys = getKeys();
export const BASE_URL = 'http://127.0.0.1:4173/vptu-mvp-task/';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.js/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './global-setup.mjs',
  use: {
    baseURL: BASE_URL,
    locale: 'vi-VN',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'npm --prefix ../../frontend run build && npm --prefix ../../frontend run preview',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: keys.url, VITE_SUPABASE_ANON_KEY: keys.anon },
  },
});
