// GĐ20 (giao diện v7) — bố cục điện thoại cho từng vai (chỉ chạy ở project `mobile`, 360×740): không cuộn ngang; hàng menu ẩn, thanh dưới có
// 3 mục theo vai (+ "Khác" khi còn mục); dải nhận diện gọn (cờ, biểu trưng, tên người dùng); màn hình điều hành của vai hiện; sang Nhiệm vụ:
// danh sách và ngăn chi tiết xếp một cột; màn đăng nhập vừa khung. Không tạo dữ liệu.
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { pageAs, contextAs, nav } from './lib/app.js';
import { OPTIONAL_USERS, storageStatePath } from './lib/roles.mjs';

test.skip(({ isMobile }) => !isMobile, 'Chỉ chạy ở project điện thoại.');

const khongCuonNgang = async (page) => {
  const { w, vw } = await page.evaluate(() => ({ w: globalThis.document.documentElement.scrollWidth, vw: globalThis.innerWidth }));
  expect(w, 'không cuộn ngang').toBeLessThanOrEqual(vw);
};

const VAI = [
  { role: 'A1', tieuDe: 'Điều hành hôm nay', duoi: ['Điều hành', 'Giao việc', 'Nhiệm vụ', 'Khác'] },
  { role: 'A2', tieuDe: 'hôm nay', duoi: ['Phòng tôi', 'Giao việc', 'Nhiệm vụ', 'Khác'] },
  { role: 'A3', tieuDe: 'Việc của tôi', duoi: ['Việc của tôi', 'Theo dõi', 'Nhắn tin'] },
];

for (const v of VAI) {
  test(`${v.role}: thanh dưới đúng 3 mục, không cuộn ngang, sang Nhiệm vụ một cột`, async ({ browser }, testInfo) => {
    const page = await pageAs(browser, v.role, testInfo);
    await expect(page.locator('#mainNav')).toBeHidden();
    await expect(page.locator('#thanhDuoi')).toBeVisible();
    const nut = page.locator('#thanhDuoi button');
    await expect(nut).toHaveText(v.duoi.map((t) => new RegExp(`^${t}`)));
    await expect(page.locator('#navDieuHanhDuoi')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#viewDieuHanh h1').first()).toContainText(v.tieuDe);
    await expect(page.locator('#currentUserDisplay')).toBeVisible();
    await expect(page.locator('#mainHeader .logo')).toBeVisible();
    expect((await page.locator('#mainHeader').boundingBox()).height).toBeLessThan(80);
    await khongCuonNgang(page);

    await nav(page, 'navKl');
    await expect(page.locator('#viewKl')).toBeVisible();
    if (await page.locator('#navKlDuoi').count()) await expect(page.locator('#navKlDuoi')).toHaveAttribute('aria-selected', 'true'); // A3 không có mục Nhiệm vụ
    const cot = await page.locator('#viewKl .md').evaluate((el) => globalThis.getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(cot, 'danh sách và ngăn chi tiết một cột').toBe(1);
    await khongCuonNgang(page);
    const row = page.locator('#klBody [id^="klRow-"]').first();
    if (await row.count() > 0) {
      await row.click();
      await expect(page.locator('#klChiTiet .chi-tiet-noi')).toBeVisible();
      await khongCuonNgang(page);
    }
    if (v.duoi.includes('Khác')) {
      await page.locator('#navKhacDuoi').click();
      await expect(page.locator('#thanhKhac')).toBeVisible();
      await expect(page.locator('#thanhKhac button').first()).toBeVisible();
    }
    await page.context().close();
  });
}

test('A0: thanh dưới Điều hành · Chỉ đạo · Tra cứu; số-lọc xếp 2 cột; thanh trái thành hàng cuộn ngang', async ({ browser }, testInfo) => {
  test.skip(!existsSync(storageStatePath('A0')), 'Chưa có demo_a0 trên project này.');
  const page = await (await contextAs(browser, 'A0', testInfo)).newPage();
  await page.goto('./');
  await expect(page.locator('#currentUserDisplay')).toContainText(OPTIONAL_USERS.A0.fullName);
  await expect(page.locator('#thanhDuoi button')).toHaveText(['Điều hành', 'Chỉ đạo', 'Tra cứu']);
  await expect(page.locator('#dhKpi button')).toHaveCount(4);
  expect(await page.locator('#dhKpi').evaluate((el) => globalThis.getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
  expect(await page.locator('#dhRay').evaluate((el) => globalThis.getComputedStyle(el).display)).toBe('flex');
  await khongCuonNgang(page);
  await page.context().close();
});

test('màn đăng nhập vừa khung điện thoại', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#loginSection')).toBeVisible();
  const the = await page.locator('.dn-the').boundingBox();
  expect(the.width).toBeLessThanOrEqual(page.viewportSize().width);
  await khongCuonNgang(page);
});
