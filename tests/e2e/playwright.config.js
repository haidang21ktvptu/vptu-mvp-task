// Playwright chạy trên bản build Vite (vite preview) trỏ tới staging; 2 kích thước màn hình
// (1280px máy tính, 360px điện thoại — SPEC NF-4).
//
// Tiết kiệm lượt đăng nhập (giới hạn 30 lượt/5 phút/IP): project `desktop` và `mobile` dùng phiên do global-setup
// tạo, mỗi context một cặp token riêng qua refresh (lib/app.js, CI-4); project `dang-nhap` (kịch bản 1–3: đăng nhập thật
// qua form rồi đăng xuất, kịch bản 3 đã ở kích thước điện thoại) chạy SAU CÙNG vì đăng xuất huỷ phiên ở mọi thiết bị.
// Tổng 7 lượt đăng nhập/lần chạy.
//
// workers = 2 (GĐ18): mỗi spec ghi dữ liệu có tài khoản A3 riêng (seed demo_e2e_*), realtime có cặp A2/A3 riêng phòng E2E_RT,
// kl-dashboard đọc bằng PCVP khối Quản trị (không spec nào ghi ở đó); các assert "ô Tổng + 1" đổi thành "≥" vì worker kia có
// thể thêm việc cùng lúc. Project mobile chạy SAU desktop (dependencies) để cùng một spec không chạy chồng trên cùng tài khoản.
//
// Thời gian CI (GĐ15, mục tiêu job kiem-thu-staging < 3 phút): điện thoại CHỈ chạy các spec nhạy bố cục — đăng nhập,
// màn hình chuyên viên, form giao việc, luồng nhận việc (thẻ dọc, modal, bàn phím). Dashboard, realtime, quản trị,
// điều hành ngoại lệ chỉ chạy máy tính: logic không phụ thuộc kích thước và phần realtime là phần tốn thời gian nhất.
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
  workers: 2,
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
    { name: 'desktop', use: DESKTOP, testIgnore: ['**/dang-nhap.spec.js', '**/chi-dao-tt.spec.js', '**/bo-cuc-mobile.spec.js', '**/smoke/**'] },
    // GĐ19: chi-dao-tt ghi nhiệm vụ vào phạm vi PCVP2 (Quản trị) — chạy SAU desktop để không đua với bộ số kl-dashboard (PCVP2).
    { name: 'chi-dao-tt', use: DESKTOP, testMatch: /chi-dao-tt\.spec\.js/, dependencies: ['desktop'] },
    // Spec nhạy bố cục — chạy cả hai kích thước (dang-nhap ở project riêng bên dưới).
    { name: 'mobile', use: MOBILE, testMatch: [/kl-chuyen-vien\.spec\.js/, /kl-them-nhiem-vu\.spec\.js/, /nhiem-vu\.spec\.js/, /bo-cuc-mobile\.spec\.js/], testIgnore: ['**/smoke/**'], dependencies: ['desktop'] },
    { name: 'dang-nhap', use: DESKTOP, testMatch: /dang-nhap\.spec\.js/, dependencies: ['desktop', 'mobile', 'chi-dao-tt'] },
  ],
  webServer: {
    command: 'npm --prefix ../../frontend run build && npm --prefix ../../frontend run preview',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: keys.url, VITE_SUPABASE_ANON_KEY: keys.anon },
  },
});
