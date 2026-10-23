// v3.29 (chủ dự án 22/10/2026): Báo cáo theo phòng chuyên môn và theo chuyên viên thực hiện của mỗi phòng — sáu cột (Tổng số nhiệm vụ, Quá hạn,
// Sắp đến hạn, Đang thực hiện, Hoàn thành, Trước hạn) ở mọi bảng, bỏ 4 cột chất lượng. Đọc mọi số trong MỘT lượt JS (worker kia có thể thêm việc,
// realtime vẽ lại): mỗi dòng Tổng = Quá hạn + Sắp đến hạn + Đang thực hiện + Hoàn thành, Trước hạn ≤ Hoàn thành; cộng các phòng = số ở dải đầu
// trang; ở bảng chuyên viên, dòng phòng = tổng các dòng cán bộ của phòng = dòng của phòng đó ở bảng theo phòng; bấm một số của cán bộ → danh sách
// đúng số việc ngay dưới dòng, bấm lại thì gập. Chánh VP (thấy mọi việc). Chỉ đọc — không tạo dữ liệu.
// v3.30 (chủ dự án 23/10/2026): xem theo kỳ — mặc định Năm; Nhiệm kỳ, từ ngày đến ngày: dải số và bảng theo phòng cộng khớp nhau ở mọi kỳ; khoảng ngày
// không có việc hoàn thành → cột Hoàn thành, Trước hạn bằng 0 (việc chưa hoàn thành vẫn tính tới hôm nay); không còn dòng "Cách tính".
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

test('Báo cáo theo kỳ: mặc định Năm; Nhiệm kỳ, từ ngày đến ngày — dải số và bảng cộng khớp; khoảng không có việc hoàn thành thì Hoàn thành = 0', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A1', testInfo);
  await nav(page, 'navBaoCao');
  const bc = page.locator('#viewBaoCao');
  await expect(bc.locator('#bcTheoPhong tbody tr.bc-hang').first()).toBeVisible(NAP);
  await expect(bc.locator('#bcKy [data-action="bcKy"]')).toHaveCount(4);
  await expect(bc.locator('#bcKy [data-ky="nam"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(bc).not.toContainText('Cách tính');
  // Đọc trong MỘT lượt JS: sáu ô đầu của dải số (tổng, quá hạn, sắp đến hạn, đang thực hiện, hoàn thành, trước hạn) và cột Tổng của bảng theo phòng.
  const doc = () => page.evaluate(() => {
    const d = globalThis.document;
    return { dau: [...d.querySelectorAll('#viewBaoCao .tq .o-so b')].slice(0, 6).map((b) => Number(b.textContent)),
      phong: [...d.querySelectorAll('#bcTheoPhong tbody tr.bc-hang')].map((tr) => Number(tr.querySelector('td.so button')?.textContent || 0)) };
  });
  const kiem = (x, nhan) => {
    const [tong, qua, sap, dang, xong, truoc] = x.dau;
    expect(qua + sap + dang + xong, `${nhan}: dải đầu cộng đủ`).toBe(tong);
    expect(truoc, `${nhan}: Trước hạn thuộc Hoàn thành`).toBeLessThanOrEqual(xong);
    expect(x.phong.reduce((s, n) => s + n, 0), `${nhan}: cộng các phòng = dải đầu`).toBe(tong);
  };
  kiem(await doc(), 'Năm');
  await bc.locator('#bcKy [data-ky="nhiem-ky"]').click();
  await expect(bc.locator('#bcKy [data-ky="nhiem-ky"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(bc.locator('#bcKyMoTa')).toContainText('Nhiệm kỳ 2025–2030 (15/9/2025 – 31/12/2030)');
  kiem(await doc(), 'Nhiệm kỳ');
  // Gõ phím như người dùng: Chromium báo "change" sau mỗi phím cho ra ngày hợp lệ (cả năm gõ dở 0002, 0020…) — ô ngày không được thay giữa chừng.
  // Ngày = tháng để đúng với mọi thứ tự ngày / tháng của ô ngày.
  const go = async (id, so) => { await bc.locator(id).focus(); await page.keyboard.type(so); };
  await go('#bcTu', '01012001');
  await go('#bcDen', '12122001');
  await expect(bc.locator('#bcKyMoTa')).toContainText('Từ 1/1/2001 đến 12/12/2001');
  await expect(bc.locator('#bcDen')).toBeFocused();
  await expect(bc.locator('#bcKy [aria-pressed="true"]')).toHaveCount(0);
  const x = await doc();
  kiem(x, 'Khoảng 1/1–12/12/2001');
  expect(x.dau[4], 'không việc nào hoàn thành năm 2001').toBe(0);
  await bc.locator('#bcKy [data-ky="quy"]').click();   // nút nhanh xoá hai ô ngày
  await expect(bc.locator('#bcTu')).toHaveValue('');
  await expect(bc.locator('#bcKy [data-ky="quy"]')).toHaveAttribute('aria-pressed', 'true');
  kiem(await doc(), 'Quý');
  await page.context().close();
});
