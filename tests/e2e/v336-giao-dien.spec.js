// v3.36 (Đợt 1, phần 4 — CAU-HOI V-1): menu bốn nhóm thu gọn được (lãnh đạo mặc định thu nhóm Nhiệm vụ quý BTV; lựa chọn nhớ theo máy; mở chức năng
// nằm trong nhóm đang thu thì nhóm tự mở); Cần xử lý bỏ dải ô số trùng Tổng quan, nội dung việc trong thẻ tối đa hai dòng; "In báo cáo nhanh" từ Tổng
// quan: bản in có phần đầu theo thể thức Văn phòng, chỉ tầng 1, ma trận đơn vị và 5 điểm nghẽn. Cần xử lý hiện các dòng đầu (V-13). Chỉ đọc — không tạo
// dữ liệu.
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

// v3.36 (CAU-HOI V-13, DESIGN mục 17): Cần xử lý ở trạng thái mặc định của người dùng thật (dsGon) — danh sách việc nghẽn hiện 10 việc đầu, nút "Xem tất
// cả N việc" mở hết và nhớ theo máy; thứ tự xếp ở nút "i"; thanh trái chỉ còn tên và số (lời giải thích ở gợi ý); không còn nhãn mặc định "chưa chỉ đạo".
test('A1: Cần xử lý hiện 10 việc đầu, "Xem tất cả" nhớ theo máy; ghi chú ở nút "i", thanh trái không còn dòng giải thích', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A1', testInfo, { dsGon: true });
  await expect(page.locator('#dhTinhDen')).toContainText('số liệu lúc', NAP);
  const the = page.locator('#dsThe .the'); const nut = page.locator('[data-action="dsHet"][data-ds="dhThe"]');
  await expect(page.locator('#dsPhu')).toHaveCount(0);
  await expect(page.locator('#dsTieuDe + .nut-goi')).toHaveAttribute('data-goi', /^Xếp theo mức khẩn/);
  await expect(page.locator('#dhRay button small')).toHaveCount(0);
  for (const b of await page.locator('#dhRay button[data-khau]').all()) await expect(b).toHaveAttribute('data-goi', /.+: .+/);
  await expect(page.locator('#dsThe')).not.toContainText('chưa chỉ đạo');
  if (await the.count() <= 10) {   // phạm vi ít việc nghẽn: không có nút, mọi thẻ hiện
    await expect(nut).toHaveCount(0);
    await expect(page.locator('#dsThe .the[data-sau]')).toHaveCount(0);
    await page.context().close();
    return;
  }
  await expect(page.locator('#dsThe .the:not([data-sau])')).toHaveCount(10);
  await expect(the.nth(10)).toBeHidden();
  await expect(nut).toHaveText(/^Xem tất cả \d+ việc$/);
  await expect(nut).toHaveAttribute('aria-expanded', 'false');
  await nut.click();
  await expect(nut).toHaveText('Chỉ hiện 10 việc đầu');
  await expect(nut).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#dsThe .the[data-sau]')).toHaveCount(0);
  await expect(the.nth(10)).toBeVisible();
  await page.reload();
  await expect(page.locator('#mainHeader')).toBeVisible(NAP);
  await nav(page, 'navDieuHanh');
  await expect(nut, 'lựa chọn "Xem tất cả" nhớ theo máy').toHaveText('Chỉ hiện 10 việc đầu', NAP);
  await expect(page.locator('#dsThe .the[data-sau]')).toHaveCount(0);
  await nut.click();
  await expect(nut).toHaveText(/^Xem tất cả \d+ việc$/);
  await expect(page.locator('#dsThe .the:not([data-sau])')).toHaveCount(10);
  await page.context().close();
});

test('A1: In báo cáo nhanh — bấm nút: phần đầu theo thể thức, tầng 1, ma trận (6 dòng + Tổng cộng), 5 điểm nghẽn; afterprint trả lại màn hình', async ({ browser }, testInfo) => {
  // V-13: in từ trạng thái mặc định của người dùng thật — mọi khối phân tích đang gập trên màn hình; bản in vẫn có ma trận, điểm nghẽn, câu kết luận đủ.
  const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true, tqGap: true });
  await expect(page.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
  await expect(page.locator('#tqIn')).toBeVisible();
  await expect(page.locator('#tqTang1 .tq-in-dau')).toBeHidden();
  await expect(page.locator('#tqMaTran')).toHaveAttribute('data-gap', '');
  await expect(page.locator('#tqMaTran .bang-mt')).toBeHidden();
  await expect(page.locator('#tqMaTran .khoi-so')).toBeVisible();
  await expect(page.locator('#tqKhoiTatCa')).toHaveText('Mở tất cả');
  // Bấm nút thật, hộp in của trình duyệt thay bằng hàm rỗng: nút gắn lớp in-tq và khổ A4 dọc tạm (chỉ cho bản in này), afterprint gỡ cả hai.
  await page.evaluate(() => { globalThis.print = () => {}; });
  await page.locator('#tqIn').click();
  await expect(page.locator('body')).toHaveClass(/\bin-tq\b/);
  await expect(page.locator('#tqInTrang')).toHaveCount(1);
  expect(await page.locator('#tqInTrang').textContent()).toContain('A4 portrait');
  await page.emulateMedia({ media: 'print' });
  const dau = page.locator('#tqTang1 .tq-in-dau');
  await expect(dau).toBeVisible();
  await expect(dau).toContainText('VĂN PHÒNG');
  await expect(dau).toContainText('ĐẢNG CỘNG SẢN VIỆT NAM');
  await expect(dau).toContainText('BÁO CÁO NHANH');
  await expect(page.locator('#tqSo')).toBeHidden();   // dải điều hành và bốn thẻ không in — bản in dùng bảng năm chỉ tiêu
  await expect(page.locator('#tqTang1 .tq1-bang-in .dong-in')).toHaveCount(5);
  await expect(page.locator('#tqTang1 .tq1-bang-in')).toBeVisible();
  await expect(page.locator('#tqKetLuan .chi-in'), 'bản in ghi câu kết luận đủ').toBeVisible();
  await expect(page.locator('#tqKetLuan .chi-man')).toBeHidden();
  await expect(page.locator('#tqMaTran')).toBeVisible();
  await expect(page.locator('#tqMaTran .bang-mt'), 'khối gập trên màn hình vẫn in đủ').toBeVisible();
  await expect(page.locator('#tqMaTran .khoi-so')).toBeHidden();
  await expect(page.locator('#tqLoc')).toBeHidden();
  await expect(page.locator('#mainHeader')).toBeHidden();
  for (const id of ['#tqXepHang', '#tqThang', '#tqVanBan']) if (await page.locator(id).count()) await expect(page.locator(id)).toBeHidden();
  const dong = page.locator('#tqNghen .bang-ng tbody tr');
  if (await dong.count() > 5) {
    await expect(dong.nth(4)).toBeVisible();
    await expect(dong.nth(5)).toBeHidden();
    await expect(page.locator('#tqNghen .chan-ng .chi-in')).toBeVisible();
  }
  const dongMt = page.locator('#tqMaTran .bang-mt tbody tr');
  if (await dongMt.count() > 6) {
    await expect(dongMt.nth(5)).toBeVisible();
    await expect(dongMt.nth(6)).toBeHidden();
    await expect(page.locator('#tqMaTran .mt-chi-in')).toBeVisible();
  }
  await expect(page.locator('#tqMaTran .bang-mt tfoot tr')).toBeVisible();   // Tổng cộng luôn in
  await expect(page.locator('.chan-in')).toBeHidden();   // chân in chung không lặp với chân của báo cáo nhanh
  await expect(page.locator('.tq-in-chan')).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => globalThis.dispatchEvent(new globalThis.Event('afterprint')));
  await expect(page.locator('body')).not.toHaveClass(/\bin-tq\b/);
  await expect(page.locator('#tqInTrang')).toHaveCount(0);
  await expect(dau).toBeHidden();
  await expect(page.locator('#tqLoc')).toBeVisible();
  await expect(page.locator('#tqMaTran .bang-mt'), 'trở lại màn hình: khối vẫn gập').toBeHidden();
  await page.context().close();
});
