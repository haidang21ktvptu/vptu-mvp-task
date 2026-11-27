// Giao diện v9 — Tổng quan (trang mở đầu của A0/A1/A2) và kiểu giao diện: A1 vào thẳng Tổng quan; số cảnh báo ở dải đầu = tổng mức cảnh báo
// trong bảng theo phòng (cùng một lần vẽ); v9 đợt 2: bấm một số → danh sách đúng số việc đó trong ngăn chi tiết NGAY TẠI CHỖ → chi tiết → quay
// lại → đóng (không đổi mục, #klChiTiet không trùng id, trả về màn Nhiệm vụ khi đóng); đổi kỳ tại chỗ; sang "Cần xử lý" (ba câu hỏi đầu
// trang) rồi quay lại; A2 thấy bảng theo cán bộ; A3 không có mục Tổng quan; Trang nghiêm / Nền tối đổi tại chỗ và nhớ theo máy sau khi tải
// lại. v3.29 (chủ dự án 22/10/2026): mức cảnh báo ghi bằng nghĩa, các phần cộng đủ số của ô. v3.36 (ba tầng): năm thẻ tầng 1 thay dải đầu, ma
// trận đơn vị (Trưởng phòng: cán bộ) thay bảng theo phòng / cán bộ. v3.36 (CAU-HOI V-13, số trước, chi tiết bấm mới mở): thẻ chỉ còn số và nhãn —
// phần tách của con số nằm ở gợi ý (data-goi) và nhãn đọc màn hình; câu kết luận gọn trên màn hình, câu đủ ở bản in. Chỉ đọc — không tạo dữ liệu.
import { test, expect } from '@playwright/test';
import { pageAs, nav, NAP } from './lib/app.js';
import { dbAdmin, homNay, cong } from './lib/pr2b.mjs';
import { DICH } from './lib/keys.mjs';

test.describe('Tổng quan và kiểu giao diện (v9)', () => {
  test('A1: vào thẳng Tổng quan; năm thẻ cộng đủ, khớp ma trận; bấm thẻ mở ngăn tại chỗ; đổi kỳ; sang Cần xử lý và quay lại', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true });
    const tq = page.locator('#viewTongQuan');
    await expect(tq).toHaveAttribute('data-nap', /./, NAP);
    await expect(page.locator('#navTongQuan')).toHaveAttribute('aria-selected', 'true');
    await expect(tq.locator('h1')).toHaveText('Tổng quan thực hiện nhiệm vụ');
    // v3.36 (ba tầng, dải điều hành — CAU-HOI V-11): dải mang ba số tổng, bốn thẻ — các phần của mỗi thẻ cộng đủ số thẻ (ghi bằng nghĩa, DESIGN mục 13);
    // số của dải cộng đủ; dòng Tổng cộng của ma trận đơn vị khớp thẻ. V-13: phần tách ở gợi ý của thẻ (data-goi), thẻ không còn dòng chữ phụ.
    const so = await tq.evaluate((el) => {
      const the = (k) => el.querySelector(`#tqSo [data-so="${k}"]`);
      const gia = (k) => Number(the(k).querySelector('.gia').textContent);
      const tong = [...el.querySelectorAll('#tqMaTran tfoot td')].map((td) => Number(td.textContent.replace(/\D/g, '') || 0));
      return { qh: gia('qh'), th: gia('th'), xong: gia('xong'), tongKy: gia('tong'), dangMo: gia('mo'), the: el.querySelectorAll('#tqSo .the-so').length,
        phuQh: the('qh').dataset.goi, phuTh: the('th').dataset.goi, nhanQh: the('qh').getAttribute('aria-label'), dongPhu: el.querySelectorAll('#tqSo .phu-h, #tqSo .so-dung-chu small').length, tong };
    });
    expect(so.the, 'bốn thẻ tầng 1').toBe(4);
    expect(so.dongPhu, 'V-13: dải và thẻ không còn dòng chữ phụ dưới con số').toBe(0);
    if (so.qh) expect(so.nhanQh, 'nhãn đọc màn hình của thẻ quá hạn có phần tách').toContain(so.phuQh);
    expect(so.dangMo, 'dải: đang thực hiện = quá hạn + trong hạn').toBe(so.qh + so.th);
    expect(so.tongKy, 'dải: nhiệm vụ của kỳ = hoàn thành trong kỳ + đang thực hiện').toBe(so.xong + so.dangMo);
    const qh = so.phuQh.match(/^(\d+) quá hạn dưới \d+ ngày, (\d+) quá hạn từ \d+ ngày trở lên$/);
    if (so.qh) expect(Number(qh?.[1]) + Number(qh?.[2]), `thẻ quá hạn cộng đủ: "${so.phuQh}"`).toBe(so.qh);
    else expect(so.phuQh).toBe('Không có nhiệm vụ quá hạn');
    const th = so.phuTh.match(/^(\d+) trong hạn, (\d+) sắp đến hạn \(còn ≤ \d+ ngày\)(?:, (\d+) chưa có hạn hoặc thường xuyên)?$/);
    expect(th, `thẻ trong hạn: "${so.phuTh}"`).toBeTruthy();
    expect(Number(th[1]) + Number(th[2]) + Number(th[3] || 0), 'thẻ trong hạn cộng đủ').toBe(so.th);
    if (so.tong.length) {   // ma trận: [quá hạn ≥ N, quá hạn < N, sắp đến hạn, trong hạn, chưa có hạn, hoàn thành, đúng hạn]
      expect(so.tong[0] + so.tong[1], 'ma trận: hai cột quá hạn = thẻ quá hạn').toBe(so.qh);
      expect(so.tong[2] + so.tong[3] + so.tong[4], 'ma trận: sắp đến hạn + trong hạn + chưa có hạn = thẻ trong hạn').toBe(so.th);
      expect(so.tong[5], 'ma trận: hoàn thành = thẻ hoàn thành').toBe(so.xong);
    }

    // Bấm một thẻ → danh sách đúng các việc làm nên số đó, mở ngay trên Tổng quan; bấm việc → chi tiết; Quay lại; Đóng. Đọc số và bấm trong
    // cùng một lượt JS (worker kia có thể thêm việc, realtime vẽ lại số) — đủ năm thẻ / hai vai ở ngan-chi-tiet.spec.js.
    const soBam = await page.evaluate(() => { const o = globalThis.document.querySelector('#tqSo [data-so="th"]'); const n = Number(o.querySelector('.gia').textContent); o.click(); return n; });
    const ngan = page.locator('#nganCT');
    await expect(ngan).toBeVisible();
    await expect(ngan.locator('.nct-viec')).toHaveCount(soBam);
    if (soBam > 0) {
      await ngan.locator('.nct-viec').first().click();
      await expect(ngan.locator('#nganCTViec .chi-tiet-noi')).toBeVisible(NAP);
      await expect(page.locator('#klChiTiet'), 'ngăn chi tiết là MỘT nút (chuyển vào ngăn, không dựng bản thứ hai)').toHaveCount(1);
      await expect(tq).toBeVisible();
      await expect(page.locator('#navTongQuan')).toHaveAttribute('aria-selected', 'true');
      await ngan.locator('#nganCTLui').click();
      await expect(ngan.locator('.nct-viec').first()).toBeVisible();
    }
    await ngan.locator('#nganCTDong').click();
    await expect(ngan).toBeHidden();
    await expect(page.locator('#viewKl #klChiTiet')).toHaveCount(1);

    await page.locator('#tqKy [data-ky="thang"]').click();
    await expect(page.locator('#tqKy [data-ky="thang"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tqSo [data-so="tong"] .nhan-so')).toContainText('của tháng');

    await nav(page, 'navDieuHanh');
    await expect(page.locator('#viewDieuHanh')).toBeVisible();
    await expect(page.locator('#dhTieuDeTrang')).toHaveText('Cần xử lý hôm nay');
    await expect(page.locator('#dhBaCau .ba-cau .bc-o')).toHaveCount(3, NAP);
    await nav(page, 'navTongQuan');
    await expect(tq).toBeVisible();
    await page.context().close();
  });

  test('A2: Tổng quan phòng, ma trận theo cán bộ; A3 không có mục Tổng quan', async ({ browser }, testInfo) => {
    const tp = await pageAs(browser, 'A2', testInfo, { oTongQuan: true });
    await expect(tp.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
    await expect(tp.locator('#viewTongQuan h1')).toHaveText('Tổng quan Phòng Tổng hợp');
    await expect(tp.locator('#tqMaTran h2')).toContainText('Theo cán bộ và trạng thái');   // v3.36: ma trận theo cán bộ (tầng 2)
    await expect(tp.locator('#tqNoiBo'), 'Trưởng phòng không còn khối Quản lý nội bộ').toHaveCount(0);
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

  // v3.36 (CAU-HOI V-1, DESIGN mục 3): máy chưa chọn thì lãnh đạo cỡ lớn (gốc 18px), chuyên viên cỡ vừa; chọn ở menu thì nhớ theo máy.
  test('cỡ chữ: lãnh đạo mặc định cỡ lớn, chuyên viên cỡ vừa; đổi ở menu bánh răng, nhớ sau khi tải lại', async ({ browser }, testInfo) => {
    const a1 = await pageAs(browser, 'A1', testInfo, { oTongQuan: true });
    const html = a1.locator('html');
    const goc = () => a1.evaluate(() => globalThis.getComputedStyle(globalThis.document.documentElement).fontSize);
    await expect(html).toHaveAttribute('data-co-chu', 'lon');
    expect(await goc()).toBe('18px');
    await a1.locator('#banhRangBtn').click();
    const muc = a1.locator('#banhRangMenu [data-action="doiCoChu"]');
    await expect(muc).toHaveAttribute('aria-checked', 'true');
    await muc.click();
    await expect(html).not.toHaveAttribute('data-co-chu', /./);
    expect(await goc()).toBe('16px');
    await a1.reload();
    await expect(a1.locator('#mainHeader')).toBeVisible(NAP);
    await expect(html).not.toHaveAttribute('data-co-chu', /./);
    await a1.context().close();
    const a3 = await pageAs(browser, 'A3', testInfo);
    await expect(a3.locator('#mainHeader')).toBeVisible(NAP);
    await expect(a3.locator('html')).not.toHaveAttribute('data-co-chu', /./);
    await a3.context().close();
  });

  // v3.36 (0140): có bản chụp số liệu 7 ngày trước thì thẻ quá hạn, cần ý kiến, trong hạn ghi tăng / giảm / không đổi; xu hướng đủ 12 tuần, bấm một
  // tuần mở danh sách của tuần; câu kết luận bắt đầu bằng ngày hôm nay. Bản chụp lùi ngày chỉ tạo trên Supabase cục bộ / staging, không production.
  test('so với tuần trước theo bản chụp số liệu; xu hướng 12 tuần; câu kết luận', async ({ browser }, testInfo) => {
    test.skip(DICH === 'production', 'Không tạo bản chụp lùi ngày trên production.');
    const r = await dbAdmin().rpc('kl_chup_so_lieu', { p_ngay: cong(homNay(), -7) });
    test.skip(Boolean(r.error), `Project chưa có migration 0140: ${r.error?.message}`);
    const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true });
    await expect(page.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
    // V-13: câu so sánh đủ ở nhãn đọc màn hình của thẻ; trên thẻ chỉ ghi "tăng / giảm N trong tuần" (không đổi thì không ghi), rê chuột hiện câu đủ.
    for (const k of ['qh', 'quyet', 'th']) {   // đọc nhãn và dòng so sánh trong cùng một lượt JS (realtime có thể vẽ lại giữa hai bước)
      const kq = await page.locator(`#tqSo [data-so="${k}"]`).evaluate((el) => { const ss = el.querySelector('.ss-tq'); return { nhan: el.getAttribute('aria-label'), ss: ss?.textContent ?? null, goi: ss?.dataset.goi ?? null }; });
      expect(kq.nhan, `thẻ ${k}: nhãn đọc màn hình có câu so sánh đủ`).toMatch(/(?:(?:tăng|giảm) \d+ nhiệm vụ so với tuần trước|không đổi so với tuần trước)/);
      if (/không đổi so với tuần trước/.test(kq.nhan)) expect(kq.ss, `thẻ ${k}: không đổi thì không ghi dòng so sánh`).toBeNull();
      else { expect(kq.ss).toMatch(/^(?:tăng|giảm) \d+ trong tuần$/); expect(kq.goi).toMatch(/^(?:tăng|giảm) \d+ nhiệm vụ so với tuần trước$/); }
    }
    await expect(page.locator('#tqSo [data-so="xong"]')).toHaveAttribute('data-goi', /^\d+ nhiệm vụ hoàn thành trong 7 ngày qua$/);
    // Câu kết luận: màn hình ghi câu gọn; câu đủ (bắt đầu bằng ngày hôm nay) chỉ hiện ở bản in.
    await expect(page.locator('#tqKetLuan .chi-man')).toBeVisible();
    await expect(page.locator('#tqKetLuan .chi-man')).toHaveText(/^(?:\d+ nhiệm vụ quá hạn(?:, nhiều nhất ở .+ \(\d+\))?|Không có nhiệm vụ quá hạn|Chưa có nhiệm vụ trong phạm vi theo dõi)\.$/);
    await expect(page.locator('#tqKetLuan .chi-in')).toBeHidden();
    await expect(page.locator('#tqKetLuan .chi-in')).toContainText(`Đến ngày ${Number(homNay().slice(8))}/${Number(homNay().slice(5, 7))}/${homNay().slice(0, 4)}`);
    const cot = page.locator('#tqXuHuong .tuan-cot');
    await expect(cot).toHaveCount(12);
    await cot.last().click();
    await expect(page.locator('#nganCTTieuDe')).toContainText('Tuần');
    await page.keyboard.press('Escape');
    await page.context().close();
  });
});
