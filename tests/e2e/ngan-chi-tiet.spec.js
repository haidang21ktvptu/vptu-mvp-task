// Giao diện v9 đợt 2 — ngăn chi tiết dùng chung: mọi chỗ "bấm để xem" mở NGAY TẠI CHỖ, không đổi mục. Tổng quan: 4 số dải đầu, một dòng bảng
// theo phòng / cán bộ, một tháng của biểu đồ → danh sách đúng bằng con số đã bấm; danh sách → chi tiết → Quay lại (tiêu điểm về việc vừa xem) →
// Esc đóng; khi đang mở chi tiết không có id trùng (#klChiTiet chuyển vào ngăn, không dựng bản thứ hai); chọn mục khác ở menu → ngăn tự đóng,
// #klChiTiet về màn Nhiệm vụ. Cần xử lý: ô toàn cảnh mở danh sách trong ngăn. Tìm nhanh ngoài màn Nhiệm vụ: gõ đúng một mã → mở thẳng việc đó.
// Vai A1 (toàn Văn phòng) và A2 (phòng mình). Chỉ đọc — không tạo dữ liệu. Chỉ máy tính (ngăn che phải 560px; điện thoại là toàn màn hình).
import { test, expect } from '@playwright/test';
import { pageAs, nav, NAP } from './lib/app.js';

// Đọc số và bấm TRONG CÙNG một lượt JS: worker kia có thể thêm việc (realtime vẽ lại số) giữa lúc đọc và lúc bấm — danh sách tính từ cùng dữ liệu
// với con số trên màn ngay lúc bấm, nên phải so với số của đúng lúc đó.
const docVaBam = (page, sel) => page.evaluate((s) => {
  const o = globalThis.document.querySelector(s);
  const n = Number((o.querySelector('.gia, b')?.textContent || '0').replace(/\D/g, '') || 0);
  o.click(); return n;
}, sel);
const idTrung = (page) => page.evaluate(() => {
  const dem = new Map(); globalThis.document.querySelectorAll('[id]').forEach((e) => dem.set(e.id, (dem.get(e.id) || 0) + 1));
  return [...dem].filter(([, n]) => n > 1).map(([id]) => id);
});

for (const vai of ['A1', 'A2']) {
  test(`${vai}: Tổng quan — số, dòng bảng, tháng mở danh sách đúng số đã bấm ngay tại chỗ; chi tiết, quay lại, Esc, đổi mục`, async ({ browser }, testInfo) => {
    const page = await pageAs(browser, vai, testInfo, { oTongQuan: true });
    const tq = page.locator('#viewTongQuan');
    await expect(tq).toHaveAttribute('data-nap', /./, NAP);
    const ngan = page.locator('#nganCT'); const viec = ngan.locator('.nct-viec');
    const dong = async () => { await page.keyboard.press('Escape'); await expect(ngan).toBeHidden(); };   // ngăn che phải: đóng trước khi bấm ô khác
    for (const khoa of ['giao', 'xong', 'mo', 'canh']) {
      const so = await docVaBam(page, `#tqSo [data-so="${khoa}"]`);
      await expect(ngan).toBeVisible();
      await expect(viec, `danh sách "${khoa}" trong ngăn = con số đã bấm`).toHaveCount(so);
      await expect(tq).toBeVisible();
      await expect(page.locator('#navTongQuan')).toHaveAttribute('aria-selected', 'true');
      await dong();
    }
    if (await page.locator('#tqTheoNhom .ten-bam').count()) {   // một phòng (A1) / một cán bộ (A2): đang làm + hoàn thành trong kỳ
      await page.locator('#tqTheoNhom .ten-bam').first().click();
      await expect(ngan.locator('.nct-nhom').first()).toBeVisible();
      await dong();
    }
    await page.locator('#viewTongQuan .nhom-cot').first().click();   // tháng 1: giao mới / hoàn thành
    await expect(page.locator('#nganCTTieuDe')).toContainText('Tháng 1/');
    await dong();

    await page.locator('#tqSo [data-so="giao"]').click();
    if (await viec.count()) {
      await viec.first().click();
      await expect(ngan.locator('#nganCTViec .chi-tiet-noi')).toBeVisible(NAP);
      expect(await idTrung(page), 'không có id trùng khi chi tiết mở trong ngăn').toEqual([]);
      await page.locator('#nganCTLui').click();
      await expect(viec.first()).toBeFocused();   // quay lại: tiêu điểm về đúng việc vừa xem
      await viec.first().click();
      await expect(ngan.locator('#nganCTViec .chi-tiet-noi')).toBeVisible(NAP);
    }
    await dong();
    await expect(page.locator('#viewKl #klChiTiet')).toHaveCount(1);

    await page.locator('#tqSo [data-so="giao"]').click();   // đang mở ngăn mà chọn mục khác ở menu → ngăn tự đóng
    await expect(ngan).toBeVisible();
    await nav(page, 'navDieuHanh');
    await expect(ngan).toBeHidden();
    await page.context().close();
  });
}

test('A1: Cần xử lý — ô toàn cảnh mở danh sách trong ngăn; tìm nhanh đúng một mã → mở thẳng việc, không rời trang', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A1', testInfo);   // đứng ở Cần xử lý
  await page.locator('#dhKpi [data-loc="tat"]').click();
  await expect(page.locator('#dsThe .toan-canh button').first()).toBeVisible(NAP);
  const so = await docVaBam(page, '#dsThe .toan-canh button');
  const ngan = page.locator('#nganCT');
  await expect(ngan.locator('.nct-viec')).toHaveCount(so);
  await expect(page.locator('#viewDieuHanh')).toBeVisible();
  const ma = (await ngan.locator('.nct-ma').first().textContent()).trim();
  await page.keyboard.press('Escape');
  await expect(ngan).toBeHidden();

  const o = page.locator('#timNhanhO');
  await o.fill(ma);
  await o.press('Enter');
  await expect(page.locator('#nganCTTieuDe')).toHaveText(ma, NAP);
  await expect(ngan.locator('#nganCTViec .chi-tiet-noi')).toBeVisible(NAP);
  await expect(page.locator('#nganCTLui')).toBeHidden();
  await expect(page.locator('#viewDieuHanh')).toBeVisible();
  await page.context().close();
});
