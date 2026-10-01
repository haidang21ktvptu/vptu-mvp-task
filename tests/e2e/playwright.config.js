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
    { name: 'desktop', use: DESKTOP, testIgnore: ['**/dang-nhap.spec.js', '**/doi-mat-khau.spec.js', '**/chi-dao-tt.spec.js', '**/bo-cuc-mobile.spec.js', '**/tt-giao-viec.spec.js', '**/tu-choi-ba-phia.spec.js', '**/viec-moi-tung-nguoi.spec.js', '**/giao-lai-chu-tri.spec.js', '**/ca-nhan-anh.spec.js', '**/id-duy-nhat.spec.js', '**/cap-nhat-nhanh-han.spec.js', '**/giao-viec-kiem-nhiem.spec.js', '**/han-nop-minh-chung.spec.js', '**/nghiem-thu.spec.js', '**/hanh-trinh-5-loai-van-ban.spec.js', '**/b4-b6-lanh-dao.spec.js', '**/pr3-*.spec.js', '**/_dem-goi/**', '**/smoke/**'] },
    // GĐ19: chi-dao-tt ghi nhiệm vụ vào phạm vi PCVP2 (Quản trị) — chạy SAU desktop để không đua với bộ số kl-dashboard (PCVP2).
    { name: 'chi-dao-tt', use: DESKTOP, testMatch: /chi-dao-tt\.spec\.js/, dependencies: ['desktop'] },
    // Spec nhạy bố cục — chạy cả hai kích thước (dang-nhap ở project riêng bên dưới).
    { name: 'mobile', use: MOBILE, testMatch: [/kl-chuyen-vien\.spec\.js/, /kl-them-nhiem-vu\.spec\.js/, /nhiem-vu\.spec\.js/], testIgnore: ['**/smoke/**'], dependencies: ['desktop'] },
    // GĐ23: bố cục điện thoại mở 3 trang phạm vi rộng (A0/A1/A2) — chạy riêng SAU mobile (một file = một worker) để không cùng lúc với các spec KL
    // nặng làm staging chạm statement timeout (v_nhiem_vu / v_ngoai_le).
    { name: 'bo-cuc', use: MOBILE, testMatch: /bo-cuc-mobile\.spec\.js/, dependencies: ['mobile'] },
    // GĐ22: Thường trực giao việc (A0 → CVP) và từ chối ba phía (E2E_NV ↔ A2) đổi trang chủ của A1/A2/E2E_NV — chạy sau các project trên.
    { name: 'gd22', use: DESKTOP, testMatch: [/tt-giao-viec\.spec\.js/, /tu-choi-ba-phia\.spec\.js/, /viec-moi-tung-nguoi\.spec\.js/, /giao-lai-chu-tri\.spec\.js/], dependencies: ['desktop', 'mobile', 'bo-cuc', 'chi-dao-tt'] },
    // PR-2a (logic, chỉ máy tính): ảnh hồ sơ, id duy nhất, Cập nhật nhanh khoá hạn (Q7), Giao việc theo phạm vi kiêm nhiệm (C3 — đổi phân công
    // PCVP/PCVP2 trong lúc chạy nên chạy SAU mọi project đọc số liệu của hai tài khoản này; tài khoản A3 riêng mỗi spec).
    { name: 'pr2a', use: DESKTOP, testMatch: [/ca-nhan-anh\.spec\.js/, /id-duy-nhat\.spec\.js/, /cap-nhat-nhanh-han\.spec\.js/, /giao-viec-kiem-nhiem\.spec\.js/],
      dependencies: ['desktop', 'mobile', 'bo-cuc', 'chi-dao-tt', 'gd22'] },
    // PR-2b (logic, chỉ máy tính): hạn nộp minh chứng, nghiệm thu, hành trình 5 loại văn bản, B4–B6 — chạy SAU mọi project nặng (pr2a đổi cờ /
    // phân công tạm) và NỐI TIẾP nhau (mỗi lúc một spec): CI #97 — nhiều phiên realtime cùng nạp lại làm staging Nano statement timeout.
    // Chạy riêng cả chuỗi: npx playwright test --project='pr2b-*' --no-deps --workers=1 (kèm biến đích).
    { name: 'pr2b-han-nop', use: DESKTOP, testMatch: /han-nop-minh-chung\.spec\.js/, dependencies: ['desktop', 'mobile', 'bo-cuc', 'chi-dao-tt', 'gd22', 'pr2a'] },
    { name: 'pr2b-nghiem-thu', use: DESKTOP, testMatch: /nghiem-thu\.spec\.js/, dependencies: ['pr2b-han-nop'] },
    { name: 'pr2b-hanh-trinh', use: DESKTOP, testMatch: /hanh-trinh-5-loai-van-ban\.spec\.js/, dependencies: ['pr2b-nghiem-thu'] },
    { name: 'pr2b-b4-b6', use: DESKTOP, testMatch: /b4-b6-lanh-dao\.spec\.js/, dependencies: ['pr2b-hanh-trinh'] },
    // PR-3 (chỉ máy tính): giao thật mỗi vai (cờ quan_tri_kl / kiêm nhiệm tạm), vướng mắc, hiển thị + Xuất Excel — nối tiếp sau pr2b-b4-b6, mỗi lúc một
    // spec. Ma trận ô Nguồn 7 vai × 5 loại nằm trong pr2b-han-nop (cùng phiên). Chạy riêng: npx playwright test --project='pr3-*' --no-deps --workers=1.
    { name: 'pr3-giao-that', use: DESKTOP, testMatch: /pr3-giao-that\.spec\.js/, dependencies: ['pr2b-b4-b6'] },
    { name: 'pr3-vuong-mac', use: DESKTOP, testMatch: /pr3-vuong-mac\.spec\.js/, dependencies: ['pr3-giao-that'] },
    { name: 'pr3-hien-thi', use: DESKTOP, testMatch: /pr3-hien-thi\.spec\.js/, dependencies: ['pr3-vuong-mac'] },
    // GĐ23: doi-mat-khau tạo tài khoản tạm bằng service_role và đăng nhập qua form — chạy cùng lượt cuối với dang-nhap.
    { name: 'dang-nhap', use: DESKTOP, testMatch: [/dang-nhap\.spec\.js/, /doi-mat-khau\.spec\.js/], dependencies: ['desktop', 'mobile', 'chi-dao-tt', 'gd22', 'pr2a', 'pr2b-b4-b6', 'pr3-hien-thi'] },
  ],
  webServer: {
    command: 'npm --prefix ../../frontend run build && npm --prefix ../../frontend run preview',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: keys.url, VITE_SUPABASE_ANON_KEY: keys.anon },
  },
});
