// v3.36 (Đợt 1, phần 4 — CAU-HOI V-1): menu bốn nhóm thu gọn được (lãnh đạo mặc định thu nhóm Nhiệm vụ quý BTV; lựa chọn nhớ theo máy; mở chức năng
// nằm trong nhóm đang thu thì nhóm tự mở); Cần xử lý bỏ dải ô số trùng Tổng quan, nội dung việc trong thẻ tối đa hai dòng; "In báo cáo nhanh" từ Tổng
// quan: bản in có phần đầu theo thể thức Văn phòng, chỉ tầng 1, ma trận đơn vị và 5 điểm nghẽn. Chỉ đọc — không tạo dữ liệu.
import { test, expect } from '@playwright/test';
import { pageAs, nav, NAP } from './lib/app.js';

const nhomQuy = (page) => page.locator('#mainNav .menu-nhom', { hasText: 'Nhiệm vụ quý BTV' });

test('A1: menu bốn nhóm; Nhiệm vụ quý BTV mặc định thu, bấm để mở, nhớ sau khi tải lại; mở mục của nhóm đang thu thì nhóm tự mở', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true });
  await expect(page.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
  const ten = await page.locator('#mainNav .menu-nhom').allTextContents();
  expect(ten.map((t) => t.trim()).slice(0, 3)).toEqual(['Điều hành', 'Nhiệm vụ', 'Nhiệm vụ quý BTV']);
  await expect(nhomQuy(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#navNqTongQuan')).toBeHidden();
  await nhomQuy(page).click();
  await expect(nhomQuy(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#navNqTongQuan')).toBeVisible();
  await page.reload();
  await expect(page.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
  await expect(nhomQuy(page), 'lựa chọn mở nhóm nhớ theo máy').toHaveAttribute('aria-expanded', 'true');
  await nhomQuy(page).click();
  await expect(nhomQuy(page)).toHaveAttribute('aria-expanded', 'false');
  await page.reload();
  await expect(page.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
  await expect(nhomQuy(page)).toHaveAttribute('aria-expanded', 'false');
  // Dòng Nhiệm vụ quý của tầng 1 mở Tổng quan quý: nhóm đang thu tự mở để thấy mục đang chọn.
  const moQuy = page.locator('#tqNvq [data-action="openNqTongQuan"]');
  if (await moQuy.count()) {
    await moQuy.click();
    await expect(page.locator('#navNqTongQuan')).toHaveAttribute('aria-selected', 'true', NAP);
    await expect(page.locator('#navNqTongQuan')).toBeVisible();
    await expect(nhomQuy(page)).toHaveAttribute('aria-expanded', 'true');
  }
  await page.context().close();
});

test('A1: Cần xử lý không còn dải ô số; nội dung việc trong thẻ tối đa hai dòng, đủ nguyên văn ở title', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true });
  await nav(page, 'navDieuHanh');
  await expect(page.locator('#dhBaCau .bc-o')).toHaveCount(3, NAP);
  await expect(page.locator('#dhKpi')).toHaveCount(0);
  await expect(page.locator('#dhTinhDen')).toContainText('số liệu lúc', NAP);
  const gon = page.locator('#viewDieuHanh .nd-gon').first();
  if (await gon.count()) {
    const kieu = await gon.evaluate((el) => ({ clamp: globalThis.getComputedStyle(el).webkitLineClamp, title: el.getAttribute('title') }));
    expect(kieu.clamp).toBe('2');
    expect(kieu.title.length).toBeGreaterThan(0);
  }
  await page.context().close();
});

test('A1: In báo cáo nhanh — bản in có phần đầu theo thể thức, chỉ tầng 1, ma trận, 5 điểm nghẽn; màn hình không đổi', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true });
  await expect(page.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
  await expect(page.locator('#tqIn')).toBeVisible();
  await expect(page.locator('#tqTang1 .tq-in-dau')).toBeHidden();
  await page.evaluate(() => globalThis.document.body.classList.add('in-tq'));   // như bấm nút (không mở hộp in của trình duyệt)
  await page.emulateMedia({ media: 'print' });
  const dau = page.locator('#tqTang1 .tq-in-dau');
  await expect(dau).toBeVisible();
  await expect(dau).toContainText('VĂN PHÒNG');
  await expect(dau).toContainText('ĐẢNG CỘNG SẢN VIỆT NAM');
  await expect(dau).toContainText('BÁO CÁO NHANH');
  await expect(page.locator('#tqSo')).toBeVisible();
  await expect(page.locator('#tqMaTran')).toBeVisible();
  await expect(page.locator('#tqLoc')).toBeHidden();
  await expect(page.locator('#mainHeader')).toBeHidden();
  for (const id of ['#tqXepHang', '#tqThang', '#tqVanBan']) if (await page.locator(id).count()) await expect(page.locator(id)).toBeHidden();
  const dong = page.locator('#tqNghen .bang-ng tbody tr');
  if (await dong.count() > 5) {
    await expect(dong.nth(4)).toBeVisible();
    await expect(dong.nth(5)).toBeHidden();
    await expect(page.locator('#tqNghen .chan-ng .chi-in')).toBeVisible();
  }
  await expect(page.locator('.tq-in-chan')).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => globalThis.document.body.classList.remove('in-tq'));
  await expect(dau).toBeHidden();
  await expect(page.locator('#tqLoc')).toBeVisible();
  await page.context().close();
});
