// Kịch bản 1–3 (SPEC GĐ4): đăng nhập 3 vai trò A1/A2/A3 vào đúng view; sai mật khẩu báo lỗi
// tiếng Việt; đăng xuất về màn hình đăng nhập; tải lại trang vẫn giữ phiên (Supabase Auth).
//
// Đây là bộ duy nhất đăng nhập thật qua form (4 lượt: A1 sai + A1 đúng + A2 + A3); chạy trong project
// `dang-nhap` sau cùng vì đăng xuất huỷ phiên chung của tài khoản. A3 kiểm tra ở kích thước điện thoại
// để form đăng nhập được thử ở cả hai kích thước mà không tốn thêm lượt.
import { test, expect } from '@playwright/test';
import { loginAs, expectLoggedIn, logout } from './lib/app.js';
import { MOBILE } from './lib/devices.mjs';

test.describe.serial('Đăng nhập theo vai trò', () => {
  test('Kịch bản 1: A1 (Chánh Văn phòng) đăng nhập → view Lãnh đạo; sai mật khẩu bị từ chối', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#loginSection')).toBeVisible();
    await expect(page.locator('#mainHeader')).toBeHidden();

    await page.locator('#loginUsername').fill('demo_cvp');
    await page.locator('#loginPassword').fill('sai-mat-khau');
    await page.locator('#loginSubmitBtn').click();
    await expect(page.locator('#loginError')).toHaveText('Sai tên đăng nhập hoặc mật khẩu.');

    await page.locator('#loginPassword').fill('123456');
    await page.locator('#loginSubmitBtn').click();
    await expectLoggedIn(page, 'A1');
    await expect(page.locator('#headerDeptDisplay')).toHaveText('Lãnh đạo Văn phòng');

    // Tải lại trang: phiên do Supabase Auth giữ, không phải đăng nhập lại.
    await page.reload();
    await expectLoggedIn(page, 'A1');
    await logout(page);
  });

  test('Kịch bản 2: A2 (Trưởng phòng) đăng nhập → view Trưởng phòng', async ({ page }) => {
    await loginAs(page, 'A2');
    await expect(page.locator('#headerDeptDisplay')).toHaveText('Phòng Tổng hợp');
    await logout(page);
  });

  test.describe('trên điện thoại', () => {
    test.use({ viewport: MOBILE.viewport, isMobile: true, hasTouch: true });

    test('Kịch bản 3: A3 (Chuyên viên) đăng nhập → view Chuyên viên', async ({ page }) => {
      await loginAs(page, 'A3');
      await expect(page.locator('#headerDeptDisplay')).toHaveText('Phòng Tổng hợp');
      await logout(page);
    });
  });
});
