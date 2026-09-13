// Playwright chạy trên bản build Vite (vite preview) trỏ tới staging; 2 kích thước màn hình
// (1280px máy tính, 360px điện thoại — SPEC NF-4). Chạy tuần tự vì dữ liệu dùng chung.
//
// Tiết kiệm lượt đăng nhập (giới hạn 30 lượt/5 phút/IP): project `desktop` và `mobile` dùng phiên
// sẵn (storageState) do global-setup tạo; project `dang-nhap` (kịch bản 1–3: đăng nhập thật qua form
// rồi đăng xuất) chạy SAU CÙNG vì đăng xuất huỷ phiên ở mọi thiết bị của tài khoản đó.
import { defineConfig } from '@playwright/test';
import { getKeys } from './lib/keys.mjs';
import { BASE_URL } from './global-setup.mjs';
import { DESKTOP, MOBILE } from './lib/devices.mjs';

const keys = getKeys();


export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.js/,
  testIgnore: ['**/smoke/**'],
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
    { name: 'desktop', use: DESKTOP, testIgnore: ['**/dang-nhap.spec.js', '**/smoke/**'] },
    { name: 'mobile', use: MOBILE, testIgnore: ['**/dang-nhap.spec.js', '**/smoke/**'] },
    { name: 'dang-nhap', use: DESKTOP, testMatch: /dang-nhap\.spec\.js/, dependencies: ['desktop', 'mobile'] },
  ],
  webServer: {
    command: 'npm --prefix ../../frontend run build && npm --prefix ../../frontend run preview',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: keys.url, VITE_SUPABASE_ANON_KEY: keys.anon },
  },
});
