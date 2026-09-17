// Smoke test production: bản live mở được, đăng nhập 1 tài khoản thật (secret SMOKE_*), vào app
// (đầu trang + tên cán bộ + vai trò), không lỗi console, rồi đăng xuất. Chỉ 1 lượt đăng nhập.
import { test, expect } from '@playwright/test';

const username = process.env.SMOKE_USERNAME;
const password = process.env.SMOKE_PASSWORD;

test('Bản live: đăng nhập 1 tài khoản vào app rồi đăng xuất', async ({ page }) => {
  test.skip(!username || !password, 'Thiếu SMOKE_USERNAME / SMOKE_PASSWORD');

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(e.message));

  await page.goto('./');
  await expect(page.locator('#loginSection')).toBeVisible();
  await page.locator('#loginUsername').fill(username);
  await page.locator('#loginPassword').fill(password);
  await page.locator('#loginSubmitBtn').click();

  await expect(page.locator('#loginError')).toBeEmpty();
  await expect(page.locator('#mainHeader')).toBeVisible();
  await expect(page.locator('#currentUserDisplay')).not.toBeEmpty();
  await expect(page.locator('#currentRoleDisplay')).not.toBeEmpty();
  await expect(page.locator('#loginSection')).toBeHidden();
  expect(consoleErrors, 'không có lỗi console sau khi vào app').toEqual([]);

  await page.locator('#banhRangBtn').click(); // GĐ23: Đăng xuất trong menu bánh răng
  await page.locator('#logoutBtn').click();
  await expect(page.locator('#loginSection')).toBeVisible();
});
