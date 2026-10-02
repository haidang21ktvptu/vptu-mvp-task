// Giao diện v9 — Tổng quan (trang mở đầu của A0/A1/A2) và kiểu giao diện: A1 vào thẳng Tổng quan; số cảnh báo ở dải đầu = tổng mức cảnh báo
// trong bảng theo phòng (cùng một lần vẽ); đổi kỳ tại chỗ; bấm sang "Cần xử lý" (ba câu hỏi đầu trang) rồi quay lại; A2 thấy bảng theo cán bộ;
// A3 không có mục Tổng quan; Trang nghiêm / Nền tối đổi tại chỗ và nhớ theo máy sau khi tải lại. Chỉ đọc — không tạo dữ liệu.
import { test, expect } from '@playwright/test';
import { pageAs, nav, NAP } from './lib/app.js';

test.describe('Tổng quan và kiểu giao diện (v9)', () => {
  test('A1: vào thẳng Tổng quan; cảnh báo = tổng mức trong bảng; đổi kỳ; sang Cần xử lý và quay lại', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true });
    const tq = page.locator('#viewTongQuan');
    await expect(tq).toHaveAttribute('data-nap', /./, NAP);
    await expect(page.locator('#navTongQuan')).toHaveAttribute('aria-selected', 'true');
    await expect(tq.locator('h1')).toHaveText('Tổng quan thực hiện nhiệm vụ');
    const so = await tq.evaluate((el) => {
      const gia = (k) => Number(el.querySelector(`#tqSo [data-so="${k}"] .gia`).textContent);
      const muc = [...el.querySelectorAll('#tqTheoNhom .muc-tq')].reduce((s, p) => s + Number(p.firstChild.textContent), 0);
      return { canh: gia('canh'), mo: gia('mo'), muc };
    });
    expect(so.muc, 'tổng mức cảnh báo trong bảng = số cảnh báo dải đầu').toBe(so.canh);
    expect(so.mo).toBeGreaterThanOrEqual(so.canh);

    await page.locator('#tqKy [data-ky="thang"]').click();
    await expect(page.locator('#tqKy [data-ky="thang"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tqSo [data-so="giao"] .phu-h')).toContainText('trong tháng');

    await page.locator('#tqChiDao [data-action="openDieuHanh"]').click();
    await expect(page.locator('#viewDieuHanh')).toBeVisible();
    await expect(page.locator('#dhTieuDeTrang')).toHaveText('Cần xử lý hôm nay');
    await expect(page.locator('#dhBaCau .ba-cau .bc-o')).toHaveCount(3, NAP);
    await nav(page, 'navTongQuan');
    await expect(tq).toBeVisible();
    await page.context().close();
  });

  test('A2: Tổng quan phòng, bảng theo cán bộ; A3 không có mục Tổng quan', async ({ browser }, testInfo) => {
    const tp = await pageAs(browser, 'A2', testInfo, { oTongQuan: true });
    await expect(tp.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
    await expect(tp.locator('#viewTongQuan h1')).toHaveText('Tổng quan Phòng Tổng hợp');
    await expect(tp.locator('#tqTheoNhom h2')).toHaveText('Theo cán bộ');
    await tp.context().close();
    const cv = await pageAs(browser, 'A3', testInfo);
    await expect(cv.locator('#navTongQuan')).toHaveCount(0);
    await expect(cv.locator('#viewDieuHanh')).toBeVisible();
    await cv.context().close();
  });

  test('kiểu giao diện: Trang nghiêm và Nền tối đổi tại chỗ, nhớ sau khi tải lại, trở về Thanh lịch', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A3', testInfo);
    const html = page.locator('html');
    const nenMenu = () => page.locator('#mainNav').evaluate((el) => globalThis.getComputedStyle(el).backgroundImage);
    await expect(html).not.toHaveAttribute('data-kieu', /./);
    const menuThanhLich = await nenMenu();
    await page.locator('#banhRangBtn').click();
    await page.locator('#banhRangMenu [data-action="datKieuGiaoDien"][data-kieu="trang-nghiem"]').click();
    await expect(html).toHaveAttribute('data-kieu', 'trang-nghiem');
    expect(await nenMenu()).not.toBe(menuThanhLich);
    await page.locator('#banhRangBtn').click();
    await page.locator('#banhRangMenu [data-action="doiNenToi"]').click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('#mainHeader')).toBeVisible(NAP);
    await expect(html).toHaveAttribute('data-kieu', 'trang-nghiem');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.locator('#banhRangBtn').click();
    await expect(page.locator('#banhRangMenu [data-kieu="trang-nghiem"]')).toHaveAttribute('aria-checked', 'true');
    await page.locator('#banhRangMenu [data-action="datKieuGiaoDien"][data-kieu="thanh-lich"]').click();
    await page.locator('#banhRangBtn').click();
    await page.locator('#banhRangMenu [data-action="doiNenToi"]').click();
    await expect(html).not.toHaveAttribute('data-kieu', /./);
    await expect(html).not.toHaveAttribute('data-theme', /./);
    await page.context().close();
  });
});
