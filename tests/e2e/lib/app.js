// Thao tác giao diện dùng chung cho các kịch bản e2e.
import { expect } from '@playwright/test';
import { SEED_PASSWORD } from './keys.mjs';
import { USERS, storageStatePath } from './roles.mjs';

export { USERS };

// Mở trang với phiên đăng nhập sẵn của vai trò (storageState do global-setup tạo) — không tốn lượt
// đăng nhập. Context mới theo đúng kích thước/thiết bị của project hiện tại; người gọi tự đóng context.
export async function pageAs(browser, role, testInfo) {
  const { viewport, isMobile, hasTouch, baseURL, locale } = testInfo.project.use;
  const context = await browser.newContext({
    viewport, isMobile, hasTouch, baseURL, locale, storageState: storageStatePath(role),
  });
  const page = await context.newPage();
  const settled = role === 'A2' ? waitForA2Tracking(page) : null;
  await page.goto('./');
  await expectLoggedIn(page, role);
  if (settled) await settled;
  return page;
}

// Đăng nhập qua form (SPEC AUTH-1) và chờ vào đúng view theo vai trò (AUTH-5). Tốn 1 lượt đăng nhập —
// chỉ dùng trong kịch bản kiểm tra chính việc đăng nhập (dang-nhap.spec.js).
export async function loginAs(page, role, password = SEED_PASSWORD) {
  const user = USERS[role];
  await page.goto('./');
  await page.locator('#loginUsername').fill(user.username);
  await page.locator('#loginPassword').fill(password);
  // A2: loadA2Data chạy ngay khi vào app; chờ nó xong để thao tác sau không bị vẽ lại đè lên.
  const settled = role === 'A2' ? waitForA2Tracking(page) : null;
  await page.locator('#loginSubmitBtn').click();
  await expectLoggedIn(page, role);
  if (settled) await settled;
}

// Truy vấn cuối của loadA2Data là hồ sơ CHO_DUYET; có phản hồi = bảng theo dõi đã vẽ xong.
function waitForA2Tracking(page) {
  return page.waitForResponse((r) => r.url().includes('/rest/v1/tasks') && r.url().includes('CHO_DUYET'));
}

export async function expectLoggedIn(page, role) {
  const user = USERS[role];
  await expect(page.locator('#mainHeader')).toBeVisible();
  await expect(page.locator('#currentUserDisplay')).toContainText(user.fullName);
  await expect(page.locator('#currentRoleDisplay')).toHaveText(user.roleLabel);
  await expect(page.locator('#loginSection')).toBeHidden();
  // Kiểm tra theo class "hidden" vì section có thể chưa có nội dung (kích thước 0).
  for (const [r, u] of Object.entries(USERS)) {
    if (r === role) await expect(page.locator(u.section)).not.toHaveClass(/\bhidden\b/);
    else await expect(page.locator(u.section)).toHaveClass(/\bhidden\b/);
  }
}

// Đăng xuất qua nút — supabase-js huỷ phiên ở mọi thiết bị của tài khoản (scope global), nên chỉ
// gọi trong kịch bản đăng nhập (chạy sau cùng), không gọi ở kịch bản dùng phiên chung.
export async function logout(page) {
  await page.locator('#logoutBtn').click();
  await expect(page.locator('#loginSection')).toBeVisible();
  await expect(page.locator('#mainHeader')).toBeHidden();
}

// Mở tab "Theo dõi & duyệt" của A2 và chờ loadA2Data vẽ xong bảng (truy vấn cuối là hồ sơ CHO_DUYET),
// tránh bấm vào dòng cũ rồi bị vẽ lại đè lên.
export async function openA2TrackingTab(page) {
  const loaded = waitForA2Tracking(page);
  await page.locator('#tabBtnTheoDoi').click();
  await loaded;
}
