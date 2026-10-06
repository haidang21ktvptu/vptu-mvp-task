// v3.16: màn Nhiệm vụ → "Xuất theo kỳ…" → hộp chọn kỳ (mặc định tháng hiện tại) hiện số đếm, tải tệp vptu-nhiem-vu-<kỳ>.xlsx.
// Chỉ đọc (không ghi gì lên staging); bắt sự kiện download của Playwright để kiểm tên tệp, không cần mở tệp.
import { test, expect } from '@playwright/test';
import { pageAs, nav, NAP } from './lib/app.js';

test('A1: Xuất theo kỳ — tháng hiện tại có số đếm, đổi sang tuần/quý/năm đổi nhãn, tải tệp đúng tên', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A1', testInfo);
  await nav(page, 'navKl');
  await expect(page.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
  await page.locator('#klXuatKy').click();
  await expect(page.locator('#xkModal')).toBeVisible();
  await expect(page.locator('#xkKy')).toHaveValue('thang');
  await expect(page.locator('#xkXemTruoc')).toContainText(/Tháng \d{1,2}\/\d{4} — giao trong kỳ: \d+ · hoàn thành: \d+ · đến hạn: \d+ · còn mở cuối kỳ: \d+/);
  await page.locator('#xkKy').selectOption('tuan');
  await expect(page.locator('#xkTuanWrap')).toBeVisible();
  await expect(page.locator('#xkXemTruoc')).toContainText(/Tuần \d{1,2}\/\d{4} \(/);
  await page.locator('#xkKy').selectOption('quy');
  await expect(page.locator('#xkXemTruoc')).toContainText(/Quý (I|II|III|IV)\/\d{4}/);
  await page.locator('#xkKy').selectOption('nam');
  await expect(page.locator('#xkXemTruoc')).toContainText(/Năm \d{4}/);
  await page.locator('#xkKy').selectOption('thang');
  const [tai] = await Promise.all([page.waitForEvent('download'), page.locator('#xkXuat').click()]);
  expect(tai.suggestedFilename()).toMatch(/^vptu-nhiem-vu-thang-\d{4}-\d{2}\.xlsx$/);
  await expect(page.locator('#xkModal')).toBeHidden();
  await page.context().close();
});
