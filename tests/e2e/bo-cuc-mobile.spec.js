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
    await expect(page.locator('#avatarNguoi')).toBeVisible(); // GĐ23: điện thoại chỉ hiện avatar, tên ẩn
    await expect(page.locator('#chuongBtn')).toBeVisible();
    await expect(page.locator('#mainHeader .logo')).toBeVisible();
    await expect(page.locator('#mainHeader .co-cum')).toBeVisible(); // GĐ21: cụm cờ SVG
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

test('A0: thanh dưới Điều hành · Giao việc · Chỉ đạo; số-lọc xếp 2 cột; thanh trái thành hàng cuộn ngang', async ({ browser }, testInfo) => {
  test.skip(!existsSync(storageStatePath('A0')), 'Chưa có demo_a0 trên project này.');
  const page = await (await contextAs(browser, 'A0', testInfo)).newPage();
  await page.goto('./');
  await expect(page.locator('#currentUserDisplay')).toContainText(OPTIONAL_USERS.A0.fullName);
  await expect(page.locator('#thanhDuoi button')).toHaveText([/^Điều hành/, 'Giao việc', 'Chỉ đạo', 'Khác']); // GĐ22: A0 giao việc; Tra cứu, Cán bộ, Nhắn tin vào "Khác"; pill đầu có thể kèm huy hiệu số
  await expect(page.locator('#dhKpi button')).toHaveCount(5);
  await expect.poll(() => page.locator('#dhKpi').evaluate((el) => globalThis.getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
  await expect.poll(() => page.locator('#dhRay').evaluate((el) => globalThis.getComputedStyle(el).display)).toBe('flex');
  await khongCuonNgang(page);
  await page.context().close();
});

// GĐ21: 601–900px → menu thành thanh biểu tượng dọc bên trái (chỉ biểu tượng, nhãn ở title), thanh dưới ẩn; dải cao 60px với cụm cờ SVG.
test('A1 ở 768px: thanh biểu tượng trái thay hàng pill, thanh dưới ẩn, dải 60px, không cuộn ngang', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A1', testInfo);
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.locator('#thanhDuoi')).toBeHidden();
  const menu = page.locator('#mainNav');
  await expect(menu).toBeVisible();
  const kieu = await menu.evaluate((el) => { const s = globalThis.getComputedStyle(el); return { pos: s.position, w: el.getBoundingClientRect().width, left: el.getBoundingClientRect().left }; });
  expect(kieu.pos).toBe('fixed'); expect(kieu.left).toBe(0); expect(kieu.w).toBeLessThan(70);
  await expect(menu.locator('#navKl .ico')).toBeVisible();
  await expect(menu.locator('#navKl')).toHaveAttribute('title', 'Nhiệm vụ');
  expect(Math.round((await page.locator('#mainHeader').boundingBox()).height)).toBe(60);
  await expect(page.locator('#mainHeader .co-cum')).toBeVisible();
  await khongCuonNgang(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await expect(page.locator('#thanhDuoi')).toBeVisible();
  await expect(menu).toBeHidden();
  await page.context().close();
});

test('màn đăng nhập vừa khung điện thoại', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#loginSection')).toBeVisible();
  const the = await page.locator('#loginSection .dn-the').boundingBox(); // GĐ23: trang đặt mật khẩu (ẩn) cũng dùng .dn-the
  expect(the.width).toBeLessThanOrEqual(page.viewportSize().width);
  await khongCuonNgang(page);
});
