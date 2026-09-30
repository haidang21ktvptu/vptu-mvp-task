// Kịch bản 1–3 (SPEC GĐ4): đăng nhập 3 vai trò A1/A2/A3 vào đúng view; sai mật khẩu báo lỗi
// tiếng Việt; đăng xuất về màn hình đăng nhập; tải lại trang vẫn giữ phiên (Supabase Auth).
//
// Đây là bộ duy nhất đăng nhập thật qua form (4 lượt: A1 sai + A1 đúng + A2 + A3); chạy trong project
// `dang-nhap` sau cùng vì đăng xuất huỷ phiên chung của tài khoản. A3 kiểm tra ở kích thước điện thoại
// để form đăng nhập được thử ở cả hai kích thước mà không tốn thêm lượt.
import { test, expect } from '@playwright/test';
import { loginAs, expectLoggedIn, logout } from './lib/app.js';
import { MOBILE } from './lib/devices.mjs';
import { ganTre } from './lib/tre.mjs';

// E2E_TRE_MS (mặc định tắt): context của fixture `page` cũng chịu độ trễ giả lập (lib/tre.mjs).
test.beforeEach(async ({ context }) => { await ganTre(context); });

test.describe.serial('Đăng nhập theo vai trò', () => {
  test('Kịch bản 1: A1 (Chánh Văn phòng) đăng nhập → view Lãnh đạo; sai mật khẩu bị từ chối', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#loginSection')).toBeVisible();
    await expect(page.locator('#mainHeader')).toBeHidden();
    // PR-2a lỗi (2): máy tính 1280x800 — thẻ co theo nội dung: nút Đăng nhập → dòng cuối đúng bằng khoảng cách giữa các ô, dòng cuối → đáy thẻ
    // đúng bằng padding (không còn khoảng trống do chiều cao cố định).
    const the = await page.locator('#loginForm').evaluate((f) => {
      const cs = globalThis.getComputedStyle(f); const b = f.querySelector('#loginSubmitBtn').getBoundingClientRect(); const c = f.querySelector('.cuoi').getBoundingClientRect(); const r = f.getBoundingClientRect();
      return { nutDenCuoi: c.top - b.bottom, cuoiDenDay: r.bottom - c.bottom, gap: parseFloat(cs.rowGap), pad: parseFloat(cs.paddingBottom) };
    });
    expect(the.nutDenCuoi).toBeLessThanOrEqual(the.gap + 1);
    expect(the.cuoiDenDay).toBeLessThanOrEqual(the.pad + 1);

    await page.locator('#loginUsername').fill('demo_cvp');
    await page.locator('#loginPassword').fill('sai-mat-khau');
    await page.locator('#loginSubmitBtn').click();
    await expect(page.locator('#loginError')).toHaveText('Sai tên đăng nhập hoặc mật khẩu.');

    await page.locator('#loginPassword').fill('123456');
    await page.locator('#loginSubmitBtn').click();
    await expectLoggedIn(page, 'A1');
    await expect(page.locator('#currentRoleDisplay')).toHaveText('Chánh Văn phòng'); // GĐ23: dòng 2 = chức danh, không mã vai
    await expect(page.locator('#avatarNguoi')).toHaveText('P'); // chữ cái đầu của tên (Demo Chánh Văn phòng → "phòng")
    await expect(page.locator('#chuongBtn')).toBeVisible();
    await expect(page.locator('#banhRangBtn')).toBeVisible();

    // Tải lại trang: phiên do Supabase Auth giữ, không phải đăng nhập lại.
    await page.reload();
    await expectLoggedIn(page, 'A1');
    await logout(page);
  });

  test('Kịch bản 2: A2 (Trưởng phòng) đăng nhập → view Trưởng phòng', async ({ page }) => {
    await loginAs(page, 'A2');
    await expect(page.locator('#currentRoleDisplay')).toHaveText('Trưởng phòng · Phòng Tổng hợp');
    // Menu bánh răng của Trưởng phòng: có Ủy quyền giao việc, Đăng xuất cuối cùng; không có nhóm Quản trị hệ thống.
    await page.locator('#banhRangBtn').click();
    await expect(page.locator('#banhRangMenu')).toBeVisible();
    await expect(page.locator('#banhRangMenu [role="menuitem"]').last()).toHaveText('Đăng xuất');
    await expect(page.locator('#banhRangMenu')).toContainText('Ủy quyền giao việc');
    await expect(page.locator('#banhRangMenu')).not.toContainText('Quản trị hệ thống');
    await page.keyboard.press('Escape');
    await logout(page);
  });

  test.describe('trên điện thoại', () => {
    test.use({ viewport: MOBILE.viewport, isMobile: true, hasTouch: true });

    test('Kịch bản 3: A3 (Chuyên viên) đăng nhập → view Chuyên viên', async ({ page }) => {
      await loginAs(page, 'A3');
      await expect(page.locator('#avatarNguoi')).toBeVisible(); // điện thoại: chỉ avatar, dòng tên ẩn
      await logout(page);
    });
  });
});
