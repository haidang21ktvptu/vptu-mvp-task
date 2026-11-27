// v3.36 (CAU-HOI V-13 — số trước, chi tiết bấm mới mở; sau khi kiểm bản staging ở cỡ chữ lớn, mặc định của lãnh đạo). Cán bộ: dòng của một người hai
// cột (tên không bị ép), điện thoại xếp dọc. Nhiệm vụ: ô số "sắp đến hạn" ghi ngắn, số ngày ở gợi ý; "Thêm bộ lọc" đang gập đứng cùng hàng các ô lọc;
// tên chủ trì một dòng. Báo cáo: danh sách việc dưới hàng mở rộng hiện 10 việc đầu, bản in đủ dòng. Theo văn bản: dòng phụ chỉ ghi ngày ban hành
// ("nhập lên hệ thống" ở title và bản in), nhãn cảnh báo ghi ngắn. Phím Esc ẩn hộp gợi ý. Chỉ đọc; số dòng đọc tại chỗ nên chỉ so theo mẫu.
import { test, expect } from '@playwright/test';
import { pageAs, nav, NAP } from './lib/app.js';

test('A1: Cán bộ, Nhiệm vụ, Báo cáo, Theo văn bản — dòng gọn ở cỡ chữ lớn, số ngày của nhãn ở gợi ý, Esc ẩn gợi ý', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A1', testInfo, { dsGon: true });

  await nav(page, 'navCanBo');
  const cb = page.locator('#viewCanBo');
  await expect(cb.locator('.cb section').first()).toBeVisible(NAP);
  await expect(cb.locator('.dau .nut-goi')).toHaveAttribute('data-goi', /sắp đến hạn \(còn ≤ \d+ ngày\)/);
  const doNguoi = () => cb.locator('.nguoi-hang').evaluateAll((ds) => ds.map((d) => {
    const h = d.getBoundingClientRect(); const t = d.querySelector('.nguoi-ten').getBoundingClientRect(); const s = d.querySelector('.tai-so');
    return { khuon: globalThis.getComputedStyle(d).gridTemplateAreas, rong: h.width, ten: t.width, soPhai: s.getBoundingClientRect().right, hangPhai: h.right, chu: s.innerText };
  }));
  let nguoi = await doNguoi();
  if (nguoi.length) {
    for (const n of nguoi) {
      expect(n.khuon).toBe('"ten tai" "ten so"');
      expect(n.ten, 'cột tên không bị dòng số ép').toBeGreaterThan(n.rong * 0.3);
      expect(n.soPhai, 'dòng số nằm trong dòng').toBeLessThanOrEqual(n.hangPhai + 1);
      expect(n.chu).not.toContain('(còn');
    }
    await page.setViewportSize({ width: 360, height: 740 });
    nguoi = await doNguoi();
    for (const n of nguoi) {
      expect(n.khuon, 'điện thoại: tên, thanh tải, dòng số xếp dọc').toBe('"ten" "tai" "so"');
      expect(n.ten).toBeGreaterThan(n.rong * 0.8);
      expect(n.soPhai, 'điện thoại: dòng số không tràn').toBeLessThanOrEqual(n.hangPhai + 1);
    }
    await page.setViewportSize(testInfo.project.use.viewport);
  }

  await nav(page, 'navKl');
  await expect(page.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
  await expect(page.locator('#klStats .o-so[data-nhom="SAP_DEN_HAN"]')).toHaveAttribute('data-goi', /^Còn ≤ \d+ ngày đến hạn xử lý$/);
  await expect(page.locator('#klSapGoi')).toHaveText(/^\s*\(còn ≤ \d+ ngày\)$/);
  const them = page.locator('#viewKl .kl-them'); const coSo = () => them.evaluate((d) => globalThis.getComputedStyle(d).flexBasis);
  expect(await coSo(), '"Thêm bộ lọc" đang gập: cùng hàng các ô lọc').toBe('auto');
  await them.locator('summary').click();
  expect(await coSo(), 'mở ra: trọn một hàng').toBe('100%');
  await them.locator('summary').click();
  const tenChuTri = page.locator('#klBody .bnv-ten').first();
  if (await tenChuTri.count()) expect(await tenChuTri.evaluate((d) => globalThis.getComputedStyle(d).whiteSpace)).toBe('nowrap');

  await nav(page, 'navBaoCao');
  const bc = page.locator('#viewBaoCao');
  await expect(bc.locator('#bcTheoPhong tbody tr.bc-hang').first()).toBeVisible(NAP);
  const tong = bc.locator('#bcTheoPhong tr.bc-hang td[data-nhan="Tổng"] button');
  const giaTri = await tong.evaluateAll((ds) => ds.map((d) => Number(d.textContent)));
  if (giaTri.length) {   // ô Tổng lớn nhất của bảng theo phòng
    const lon = giaTri.indexOf(Math.max(...giaTri));
    await tong.nth(lon).click();
    const viec = bc.locator('#bcMoRong .nv-dong'); const nut = bc.locator('[data-action="dsHet"][data-ds="bcViec"]');
    await expect(viec.first()).toBeVisible();
    if (await viec.count() > 10) {
      await expect(nut).toHaveText(/^Xem tất cả \d+ việc$/);
      await expect(viec.nth(9)).toBeVisible();
      await expect(viec.nth(10)).toBeHidden();
      await nut.click();
      await expect(nut).toHaveText('Chỉ hiện 10 việc đầu');
      await expect(viec.nth(10)).toBeVisible();
      await nut.click();
      await expect(viec.nth(10)).toBeHidden();
      await page.emulateMedia({ media: 'print' });
      await expect(viec.nth(10), 'bản in đủ dòng').toBeVisible();
      await page.emulateMedia({ media: 'screen' });
    } else await expect(nut).toHaveCount(0);   // ít việc: không có nút, mọi dòng hiện
    await bc.locator('#bcTheoPhong tr.bc-hang.dang td[data-nhan="Tổng"] button').click();
    await expect(bc.locator('#bcMoRong')).toHaveCount(0);
  }

  await nav(page, 'navTheoVanBan');
  const tvb = page.locator('#viewTheoVanBan');
  await expect(tvb.locator('#tvbCay')).toHaveAttribute('data-nap', /./, NAP);
  const vb = tvb.locator('.tvb-goc').first();
  if (await vb.count()) {
    await expect(vb.locator('.bnv-c-nv').first()).toHaveAttribute('title', /nhập lên hệ thống/);
    await expect(vb.locator('.bnv-hang .bnv-phu .chi-in-dong')).toBeHidden();
    await expect(vb.locator('.tvb-nguoi')).toHaveAttribute('title', /.+/);
    const nhan = tvb.locator('.tvb-goc .trang-thai.tt-cho[data-goi]').first();
    if (await nhan.count()) {
      expect(await nhan.evaluate((d) => d.firstChild.textContent)).toMatch(/^\d+ sắp đến hạn$/);
      await expect(nhan).toHaveAttribute('data-goi', /^\d+ nhiệm vụ sắp đến hạn \(còn ≤ \d+ ngày\)$/);
    }
    await page.emulateMedia({ media: 'print' });
    await expect(vb.locator('.bnv-hang .bnv-phu .chi-in-dong'), 'bản in ghi ngày nhập lên hệ thống').toBeVisible();
    await page.emulateMedia({ media: 'screen' });
  }
  const i = tvb.locator('.dau .nut-goi');
  await i.focus();
  await expect(page.locator('#goiChung')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#goiChung')).toBeHidden();
  await expect(i, 'Esc ẩn gợi ý, tiêu điểm giữ nguyên').toBeFocused();
  await page.context().close();
});
