// Playwright chạy trên bản build Vite (vite preview) trỏ tới staging; 2 kích thước màn hình
// (1280px máy tính, 360px điện thoại — SPEC NF-4). Chạy tuần tự vì dữ liệu dùng chung.
//
// Tiết kiệm lượt đăng nhập (giới hạn 30 lượt/5 phút/IP): project `desktop` và `mobile` dùng phiên do global-setup
// tạo, mỗi context một cặp token riêng qua refresh (lib/app.js, CI-4); project `dang-nhap` (kịch bản 1–3: đăng nhập thật
// qua form rồi đăng xuất, kịch bản 3 đã ở kích thước điện thoại) chạy SAU CÙNG vì đăng xuất huỷ phiên ở mọi thiết bị.
// Tổng 7 lượt đăng nhập/lần chạy.
//
// workers = 1 (CI-4 đã thử 2 worker, quay về): dữ liệu mẫu cô lập theo hội nghị (993–997) nhưng mọi spec dùng chung 3 tài
// khoản seed — khi chạy song song, spec này tạo/xoá việc của demo_cv1 làm lệch ô Tổng của spec kia (kl-them-nhiem-vu đếm
// 197 thấy 196/195), bật modal bắt buộc nhận việc ở nhiem-vu 4a, và realtime vẽ lại màn hình đúng lúc dieu-hanh đang điền
// ô phản hồi (CI #63). Muốn 2 worker phải cấp tài khoản riêng cho từng spec (seed thêm) — việc của PR sau.
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
    // Spec nhạy bố cục — chạy cả hai kích thước (dang-nhap ở project riêng bên dưới).
    { name: 'mobile', use: MOBILE, testMatch: [/kl-chuyen-vien\.spec\.js/, /kl-them-nhiem-vu\.spec\.js/, /nhiem-vu\.spec\.js/], testIgnore: ['**/smoke/**'] },
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
