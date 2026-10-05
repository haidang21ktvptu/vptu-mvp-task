// v3.15.1 (SPEC NF-14): không thao tác quá hạn → app tự đăng xuất thiết bị này và màn đăng nhập giải thích lý do. Số phút ghi đè bằng
// khoá kiểm thử localStorage `vptu-phut-het-phien` = 0.1 (6 giây) đặt trước khi trang nạp; bộ đếm kiểm mỗi 15 giây nên đợi tới ~25 giây.
// signOut scope local không chạm phiên máy chủ của tài khoản seed (các context khác vẫn chạy).
import { test, expect } from '@playwright/test';
import { contextAs } from './lib/app.js';

test('A3 không thao tác quá hạn → tự đăng xuất, màn đăng nhập ghi rõ lý do', async ({ browser }, testInfo) => {
  const context = await contextAs(browser, 'A3', testInfo);
  await context.addInitScript(() => { globalThis.localStorage.setItem('vptu-phut-het-phien', '0.1'); });
  const page = await context.newPage();
  await page.goto('./');
  await expect(page.locator('#mainHeader')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#loginSection')).toBeHidden();
  // Không chạm chuột/phím: sau 6 giây hết hạn, lần kiểm kế tiếp (≤ 15 giây) đăng xuất và tải lại trang.
  await expect(page.locator('#loginSection')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#mainHeader')).toBeHidden();
  await expect(page.locator('#loginError')).toContainText('tự đăng xuất vì không có thao tác');
  // Tải lại lần nữa: không còn phiên, không lặp lại câu giải thích (chỉ hiện một lần).
  await page.reload();
  await expect(page.locator('#loginSection')).toBeVisible();
  await expect(page.locator('#loginError')).toBeHidden();
  await context.close();
});
