// v3.36 (Tổng quan ba tầng): ảnh chụp màn hình để rà soát giao diện ngay trên PR — CI lưu thư mục tests/e2e/anh-chup thành artifact
// "…-anh-chup" (không so sánh điểm ảnh, không làm đỏ CI vì ảnh khác). Lãnh đạo Văn phòng (cỡ chữ lớn mặc định) ở 1366×768, 1920×1080 và điện thoại
// 375×812; Trưởng phòng 1366×768. Mỗi cỡ hai ảnh: màn hình đầu (tầng 1 phải vừa) và cả trang; kiểm năm thẻ nằm trong màn hình đầu (≥ 1366px) và
// không cuộn ngang. Chỉ đọc — không tạo dữ liệu.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { pageAs, NAP } from './lib/app.js';

const THU_MUC = fileURLToPath(new URL('./anh-chup/', import.meta.url));
const CO = [['A1', 1366, 768], ['A1', 1920, 1080], ['A1', 375, 812], ['A2', 1366, 768]];

test.describe('Ảnh chụp giao diện Tổng quan (rà soát trên PR)', () => {
  test.beforeAll(() => { mkdirSync(THU_MUC, { recursive: true }); });
  for (const [vai, w, h] of CO) {
    test(`${vai} ${w}×${h}`, async ({ browser }, testInfo) => {
      const page = await pageAs(browser, vai, testInfo, { oTongQuan: true });
      await page.setViewportSize({ width: w, height: h });
      await expect(page.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
      await expect(page.locator('#tqSo .the-so')).toHaveCount(5);
      await page.evaluate(() => globalThis.document.fonts.ready);
      // Tầng 1: năm thẻ nằm trong màn hình đầu (không cuộn) ở cỡ máy tính phổ biến nhất; mọi cỡ không cuộn ngang.
      if (w >= 1366) {
        const b = await page.locator('#tqSo').boundingBox();
        expect(b.y + b.height, 'năm thẻ tầng 1 nằm trong màn hình đầu').toBeLessThanOrEqual(h);
      }
      const { sw, vw } = await page.evaluate(() => ({ sw: globalThis.document.documentElement.scrollWidth, vw: globalThis.innerWidth }));
      expect(sw, 'không cuộn ngang').toBeLessThanOrEqual(vw);
      await page.screenshot({ path: `${THU_MUC}tong-quan-${vai}-${w}.png` });
      await page.screenshot({ path: `${THU_MUC}tong-quan-${vai}-${w}-ca-trang.png`, fullPage: true });
      await page.context().close();
    });
  }
});
