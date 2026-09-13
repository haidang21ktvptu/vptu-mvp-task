// Thao tác giao diện dùng chung cho các kịch bản e2e.
import { expect } from '@playwright/test';
import { SEED_PASSWORD } from './keys.mjs';

export const USERS = {
  A1: { username: 'demo_cvp', fullName: 'Demo Chánh Văn phòng', section: '#viewThuongTruc', roleLabel: 'Lãnh đạo Văn phòng (A1)' },
  A2: { username: 'demo_truongphong', fullName: 'Demo Trưởng phòng', section: '#viewLanhDaoVP', roleLabel: 'Trưởng phòng chuyên môn (A2)' },
  A3: { username: 'demo_cv1', fullName: 'Demo Chuyên viên Một', section: '#viewChuyenVien', roleLabel: 'Cán bộ thực hiện (A3)' },
};

// Đăng nhập qua form (SPEC AUTH-1) và chờ vào đúng view theo vai trò (AUTH-5).
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
  // Kiểm tra theo class "hidden" vì section có thể chưa có nội dung (kích thước 0).
  for (const [r, u] of Object.entries(USERS)) {
    if (r === role) await expect(page.locator(u.section)).not.toHaveClass(/\bhidden\b/);
    else await expect(page.locator(u.section)).toHaveClass(/\bhidden\b/);
  }
}

export async function logout(page) {
  await page.locator('#logoutBtn').click();
  await expect(page.locator('#loginSection')).toBeVisible();
  await expect(page.locator('#mainHeader')).toBeHidden();
}
