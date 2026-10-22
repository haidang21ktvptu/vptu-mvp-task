// v3.29 (chủ dự án 22/10/2026): Báo cáo theo phòng chuyên môn và theo chuyên viên thực hiện của mỗi phòng — sáu cột (Tổng số nhiệm vụ, Quá hạn,
// Sắp đến hạn, Đang thực hiện, Hoàn thành, Trước hạn) ở mọi bảng, bỏ 4 cột chất lượng. Đọc mọi số trong MỘT lượt JS (worker kia có thể thêm việc,
// realtime vẽ lại): mỗi dòng Tổng = Quá hạn + Sắp đến hạn + Đang thực hiện + Hoàn thành, Trước hạn ≤ Hoàn thành; cộng các phòng = số ở dải đầu
// trang; ở bảng chuyên viên, dòng phòng = tổng các dòng cán bộ của phòng = dòng của phòng đó ở bảng theo phòng; bấm một số của cán bộ → danh sách
// đúng số việc ngay dưới dòng, bấm lại thì gập. Chánh VP (thấy mọi việc). Chỉ đọc — không tạo dữ liệu.
import { test, expect } from '@playwright/test';
import { pageAs, nav, NAP } from './lib/app.js';

const COT = ['Tổng số nhiệm vụ', 'Quá hạn', /^Sắp đến hạn \(còn ≤ \d+ ngày\)$/, 'Đang thực hiện', 'Hoàn thành', 'Trước hạn'];

test('Báo cáo theo phòng chuyên môn, theo chuyên viên: sáu cột cộng đủ, khớp dải đầu trang và nhau; bấm số mở đúng danh sách', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A1', testInfo);
  await nav(page, 'navBaoCao');
  const bc = page.locator('#viewBaoCao');
  await expect(bc.locator('#bcTheoChuyenVien tbody tr.bc-hang').first()).toBeVisible(NAP);
  for (const id of ['bcTheoPhong', 'bcTheoChuyenVien', 'bcTheoNguon', 'bcTheoVanBan']) {
    const th = bc.locator(`#${id} thead th`);
    await expect(th, id).toHaveCount(1 + COT.length);
    for (const [i, t] of COT.entries()) await expect(th.nth(i + 1), `${id} cột ${i + 1}`).toHaveText(t);
  }
  await expect(bc.locator('#bcTheoPhong thead th').first()).toHaveText('Phòng chuyên môn');
  expect((await bc.locator('thead').allTextContents()).join(' '), 'không còn cột chất lượng').not.toMatch(/Không đạt|Đạt tốt|Đạt xuất sắc/);

  const so = await page.evaluate(() => {
    const doc = globalThis.document;
    const bang = (id) => [...doc.querySelectorAll(`#${id} tbody tr.bc-hang`)].map((tr) => ({ ten: tr.querySelector('td.tieude').firstChild.textContent, lop: tr.className,
      so: [...tr.querySelectorAll('td.so')].map((td) => Number(td.querySelector('button')?.textContent || 0)) }));   // ô 0 ghi "·"
    return { dau: Number(doc.querySelector('#viewBaoCao .tq .o-so b').textContent), phong: bang('bcTheoPhong'), cv: bang('bcTheoChuyenVien') };
  });
  const kiemDong = (d) => {
    const [tong, qua, sap, dang, xong, truoc] = d.so;
    expect(qua + sap + dang + xong, `${d.ten}: Tổng = Quá hạn + Sắp đến hạn + Đang thực hiện + Hoàn thành`).toBe(tong);
    expect(truoc, `${d.ten}: Trước hạn thuộc Hoàn thành`).toBeLessThanOrEqual(xong);
  };
  expect(so.phong.length).toBeGreaterThan(0);
  so.phong.forEach(kiemDong); so.cv.forEach(kiemDong);
  expect(so.phong.reduce((s, d) => s + d.so[0], 0), 'cộng các phòng = số nhiệm vụ ở dải đầu trang').toBe(so.dau);
  const dongPhong = so.cv.filter((d) => d.lop.includes('bc-phong'));
  expect(dongPhong.map((d) => d.ten), 'bảng chuyên viên có đủ các phòng, cùng thứ tự').toEqual(so.phong.map((d) => d.ten));
  for (const p of dongPhong) {
    const i = so.cv.indexOf(p); const j = so.cv.findIndex((d, k) => k > i && d.lop.includes('bc-phong'));
    const canBo = so.cv.slice(i + 1, j < 0 ? so.cv.length : j);
    expect(canBo.length, `${p.ten}: có dòng cán bộ`).toBeGreaterThan(0);
    expect(canBo.every((d) => d.lop.includes('bc-con'))).toBe(true);
    p.so.forEach((n, k) => expect(canBo.reduce((s, d) => s + d.so[k], 0), `${p.ten}: cột ${k + 1} = tổng các cán bộ`).toBe(n));
    expect(p.so, `${p.ten}: khớp bảng theo phòng`).toEqual(so.phong.find((d) => d.ten === p.ten).so);
  }

  // Bấm số Tổng của dòng cán bộ đầu tiên (đọc và bấm trong cùng một lượt JS) → danh sách mở ngay dưới dòng; bấm lại → gập.
  const n = await page.evaluate(() => { const o = globalThis.document.querySelector('#bcTheoChuyenVien tbody tr.bc-con td.so button'); const v = Number(o.textContent); o.click(); return v; });
  await expect(bc.locator('#bcTheoChuyenVien #bcMoRong .nv-dong')).toHaveCount(n);
  await expect(bc.locator('#bcTheoChuyenVien tr.bc-con.dang')).toHaveAttribute('aria-expanded', 'true');
  await bc.locator('#bcTheoChuyenVien tr.bc-con.dang td.so button').first().click();
  await expect(bc.locator('#bcMoRong')).toHaveCount(0);
  await page.context().close();
});
