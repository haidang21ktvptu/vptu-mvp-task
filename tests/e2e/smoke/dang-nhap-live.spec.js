// Smoke test production: bản live mở được, đăng nhập 1 tài khoản thật (secret SMOKE_*), vào app
// (đầu trang + tên cán bộ + vai trò), không lỗi console, rồi đăng xuất. Chỉ 1 lượt đăng nhập. v3.29: trước khi đăng nhập mở thẳng một đường dẫn
// chức năng và một đường dẫn lạ (trang 404 chung chuyển về app) — chưa đăng nhập thì thanh địa chỉ "/Dang-nhap"; đăng xuất cũng về "/Dang-nhap".
import { test, expect } from '@playwright/test';

const username = process.env.SMOKE_USERNAME;
const password = process.env.SMOKE_PASSWORD;

test('Bản live: đăng nhập 1 tài khoản vào app rồi đăng xuất', async ({ page }) => {
  test.skip(!username || !password, 'Thiếu SMOKE_USERNAME / SMOKE_PASSWORD');

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(e.message));

  // v3.29: đường dẫn riêng từng chức năng — mở thẳng "/Tong-quan" (tệp dựng sẵn, Pages trả 200) và một đường dẫn lạ (404.html chuyển về app kèm ?p=,
  // app đặt lại thanh địa chỉ): trang đăng nhập hiện, thanh địa chỉ "/Dang-nhap", không lỗi console (kể cả chính sách nội dung chặn nhầm).
  const diaChi = () => new URL(page.url()).pathname;
  const mo = await page.goto('./Tong-quan');
  expect(mo?.status(), 'Pages trả tệp Tong-quan.html').toBe(200);
  await expect(page.locator('#loginSection')).toBeVisible();
  await expect.poll(diaChi).toMatch(/\/Dang-nhap$/);
  for (const d of ['./Dang-nhap', './Quan-tri', './Quan-tri/Tai-khoan']) {   // có cả Quan-tri.html lẫn thư mục Quan-tri/ (index.html): đường nào Pages chọn cũng vào app
    expect((await page.goto(d))?.status(), `Pages trả ${d}`).toBe(200);
    await expect(page.locator('#loginSection')).toBeVisible();
  }
  await page.goto('./khong-co-chuc-nang-nay');
  await expect(page.locator('#loginSection')).toBeVisible();
  await expect.poll(diaChi).toMatch(/\/Dang-nhap$/);
  expect(consoleErrors.filter((e) => !/404/.test(e)), 'không lỗi console khi mở thẳng đường dẫn').toEqual([]);
  consoleErrors.length = 0;

  await page.goto('./');
  await expect(page.locator('#loginSection')).toBeVisible();
  await expect.poll(diaChi).toMatch(/\/Dang-nhap$/);
  await page.locator('#loginUsername').fill(username);
  await page.locator('#loginPassword').fill(password);
  await page.locator('#loginSubmitBtn').click();

  await expect(page.locator('#loginError')).toBeEmpty();
  await expect(page.locator('#mainHeader')).toBeVisible();
  await expect(page.locator('#currentUserDisplay')).not.toBeEmpty();
  await expect(page.locator('#currentRoleDisplay')).not.toBeEmpty();
  await expect(page.locator('#loginSection')).toBeHidden();
  await expect.poll(diaChi, 'vào app: đường dẫn của chức năng, không còn "/Dang-nhap"').not.toMatch(/\/Dang-nhap$/);
  expect(consoleErrors, 'không có lỗi console sau khi vào app').toEqual([]);

  await page.locator('#banhRangBtn').click(); // GĐ23: Đăng xuất trong menu bánh răng
  await page.locator('#logoutBtn').click();
  await expect(page.locator('#loginSection')).toBeVisible();
  await expect.poll(diaChi).toMatch(/\/Dang-nhap$/);
});
