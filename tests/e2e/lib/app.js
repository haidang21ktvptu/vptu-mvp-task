// Thao tác giao diện dùng chung cho các kịch bản e2e.
//
// Phiên riêng cho từng context (CI-4): global-setup đăng nhập mỗi vai MỘT lần (4 lượt) và lưu cặp token vào .auth/<vai>.json;
// mỗi context lấy một cặp token MỚI bằng refresh (giới hạn 150/5 phút, tách khỏi 30 lượt đăng nhập) theo chuỗi: đọc token mới
// nhất → refresh → ghi lại. Với xoay refresh token đang bật, hai context không bao giờ giữ cùng một refresh token còn hiệu lực;
// context cũ vẫn chạy bằng access token (JWT 1 giờ) tới hết lần chạy. Khoá thư mục (mkdir nguyên tử) để hai worker không refresh
// cùng một token ngoài khoảng reuse 10 giây (Supabase sẽ thu hồi cả chuỗi).
import { expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { getKeys, SEED_PASSWORD } from './keys.mjs';
import { USERS, sessionPath } from './roles.mjs';

export { USERS };

const KHOA_MS = 20_000;
const ngu = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
export const storageKey = () => `sb-${new URL(getKeys().url).hostname.split('.')[0]}-auth-token`;

// Cặp token mới cho vai (giữ khoá trong lúc refresh + ghi lại file).
export async function phienMoi(role) {
  const dir = `${sessionPath(role)}.lock`;
  const han = Date.now() + KHOA_MS;
  for (;;) {
    try { mkdirSync(dir); break; } catch (e) { if (e.code !== 'EEXIST' || Date.now() > han) throw e; ngu(100); }
  }
  try {
    const k = getKeys();
    const cu = JSON.parse(readFileSync(sessionPath(role), 'utf8'));
    const client = createClient(k.url, k.anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.refreshSession({ refresh_token: cu.refresh_token });
    if (error) throw new Error(`Làm mới phiên ${role} thất bại: ${error.message}`);
    writeFileSync(sessionPath(role), JSON.stringify(data.session));
    return data.session;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Context mới theo kích thước/thiết bị của project hiện tại, đã có phiên riêng của vai trong localStorage (khoá supabase-js đọc
// khi tải trang → app tự khôi phục phiên, không tốn lượt đăng nhập). Người gọi tự đóng context.
export async function contextAs(browser, role, testInfo) {
  const session = await phienMoi(role);
  const { viewport, isMobile, hasTouch, baseURL, locale } = testInfo.project.use;
  return browser.newContext({
    viewport, isMobile, hasTouch, baseURL, locale,
    storageState: { cookies: [], origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: storageKey(), value: JSON.stringify(session) }] }] },
  });
}

export async function pageAs(browser, role, testInfo) {
  const context = await contextAs(browser, role, testInfo);
  const page = await context.newPage();
  await page.goto('./');
  await expectLoggedIn(page, role);
  return page;
}

// Đăng nhập qua form (SPEC AUTH-1) và chờ vào đúng view theo vai trò (AUTH-5). Tốn 1 lượt đăng nhập —
// chỉ dùng trong kịch bản kiểm tra chính việc đăng nhập (dang-nhap.spec.js).
export async function loginAs(page, role, password = SEED_PASSWORD) {
  const user = USERS[role];
  await page.goto('./');
  await page.locator('#loginUsername').fill(user.username);
  await page.locator('#loginPassword').fill(password);
  await page.locator('#loginSubmitBtn').click();
  await expectLoggedIn(page, role);
}

export async function expectLoggedIn(page, role) {
  const user = USERS[role];
  await expect(page.locator('#mainHeader')).toBeVisible();
  await expect(page.locator('#currentUserDisplay')).toContainText(user.fullName);
  await expect(page.locator('#currentRoleDisplay')).toHaveText(user.roleLabel);
  await expect(page.locator('#loginSection')).toBeHidden();
  // Kiểm tra theo class "hidden" vì section có thể chưa có nội dung (kích thước 0). GĐ14: A2/A3 cùng mặc định viewKl.
  await expect(page.locator(user.section)).not.toHaveClass(/\bhidden\b/);
  for (const u of Object.values(USERS)) {
    if (u.section !== user.section) await expect(page.locator(u.section)).toHaveClass(/\bhidden\b/);
  }
}

// Đăng xuất qua nút — supabase-js huỷ phiên ở mọi thiết bị của tài khoản (scope global), nên chỉ
// gọi trong kịch bản đăng nhập (chạy sau cùng), không gọi ở kịch bản dùng phiên chung.
export async function logout(page) {
  await page.locator('#logoutBtn').click();
  await expect(page.locator('#loginSection')).toBeVisible();
  await expect(page.locator('#mainHeader')).toBeHidden();
}
