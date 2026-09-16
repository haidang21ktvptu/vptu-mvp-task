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

