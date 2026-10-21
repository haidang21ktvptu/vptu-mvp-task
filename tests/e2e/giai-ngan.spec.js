// v3.28 (0119) — giải ngân vốn đầu tư công. Chánh VP (A1): Tổng quan có khối "Giải ngân vốn" (hướng dẫn khi chưa có kỳ) → "Nhập kỳ số liệu": dán bảng
// nguồn vốn như Excel chép (HTML, số gốc x:num, "Đơn vị: triệu đồng", dòng TỔNG CỘNG, cột "Lũy kế" đứng sau cột "trong tháng") → số tổng tự điền từ
// dòng tổng, đổi ra tỷ đồng; dán bảng chủ đầu tư dạng chữ có tab → lưu → vòng %, bảng nguồn vốn / chủ đầu tư, nhiệm vụ gắn chủ đầu tư có mức đúng
// như lib/kl/giai-ngan.js tính (tiến độ đều tại ngày số liệu); ngăn chi tiết của việc "Số liệu toàn tỉnh" có mục Giải ngân vốn và diễn biến.
// Dữ liệu: việc mẫu theo khoá riêng; việc "Số liệu toàn tỉnh" của năm đặt bằng service role CHỈ KHI năm đó chưa có (staging đã có thì bỏ qua — không
// đụng số liệu kiểm tay); dọn kỳ theo căn cứ chứa khoá. Bỏ qua trên production. Chỉ máy tính (project desktop).
import { test, expect } from '@playwright/test';
import { pageAs, NAP } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan } from './lib/du-lieu.mjs';
import { dbAdmin, homNay, taoViec } from './lib/pr2b.mjs';
import { DICH } from './lib/keys.mjs';
import { namHienThi, mucGiaiNgan, nhanMuc, ptVN, tyLe } from '../../frontend/src/lib/kl/giai-ngan.js';
import { tenChuan } from '../../frontend/src/lib/kl/giai-ngan-bang.js';

const BANG_NGUON = `<table><tr><td colspan="6">Đơn vị: triệu đồng</td></tr><tr><td>STT</td><td>Nguồn vốn</td><td>Kế hoạch vốn năm</td><td>Giải ngân trong tháng</td><td>Lũy kế giải ngân đến nay</td><td>Tỷ lệ (%)</td></tr>
  <tr><td></td><td>TỔNG CỘNG</td><td x:num="8250000">8.250.000</td><td x:num="600000">600.000</td><td x:num="4450000">4.450.000</td><td>53,9</td></tr>
  <tr><td>1</td><td>Vốn ngân sách địa phương</td><td x:num="2100000">2.100.000</td><td>100.000</td><td x:num="1200000">1.200.000</td><td>57,1</td></tr>
  <tr><td>2</td><td>Vốn ngân sách trung ương</td><td x:num="4300000">4.300.000</td><td>300.000</td><td x:num="2400000">2.400.000</td><td>55,8</td></tr>
  <tr><td>3</td><td>Vốn các chương trình mục tiêu quốc gia</td><td x:num="1200000">1.200.000</td><td>150.000</td><td x:num="480000">480.000</td><td>40</td></tr>
  <tr><td>4</td><td>Vốn kéo dài năm trước</td><td x:num="650000">650.000</td><td>50.000</td><td x:num="370000">370.000</td><td>56,9</td></tr></table>`;
const CDT = 'Ban Quản lý dự án giao thông E2E';
const BANG_CDT = ['STT\tChủ đầu tư\tKế hoạch (tỷ đồng)\tĐã giải ngân (tỷ đồng)', `1\t${CDT}\t2.200\t22`, '2\tBan Quản lý dự án tỉnh E2E\t3.100\t1.700,5', '3\tUBND xã E2E\t310\t60'].join('\n');
const dan = (page, loai, { text = '', html = '' }) => page.evaluate(([l, t, h]) => {
  const o = globalThis.document.querySelector(`[data-gn-dan="${l}"]`); const dt = new globalThis.DataTransfer();
  if (h) dt.setData('text/html', h); dt.setData('text/plain', t);
  o.dispatchEvent(new globalThis.ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}, [loai, text, html]);

test.describe.serial('Giải ngân vốn đầu tư công (v3.28)', () => {
  test.describe.configure({ timeout: 120_000 });
  let db; let khoa; let vbId; let tt; let cdt; const ngay = homNay(); const nam = namHienThi(ngay);
  const don = async () => { await db.from('gn_ky').delete().like('can_cu', `%${khoa}%`); await donVanBan(db, khoa); };
  test.beforeAll(async () => {
    test.skip(DICH === 'production', 'Không ghi số liệu giải ngân trên production.');
    db = dbAdmin(); khoa = khoaRieng('GN', test.info());
    test.skip(Boolean((await db.from('gn_ky').select('id').limit(1)).error), 'Project chưa có migration 0119.');
    await don();
    const co = (await db.from('gn_nhiem_vu').select('nhiem_vu_id').eq('nam', nam).eq('loai', 'TOAN_TINH')).data || [];
    test.skip(co.length > 0, `Năm ${nam} đã có nhiệm vụ "Số liệu toàn tỉnh" trên project này — không đụng số liệu kiểm tay.`);
    vbId = await taoVanBanRieng(db, khoa);
    tt = await taoViec(db, vbId, `${khoa} Theo dõi, tổng hợp tiến độ giải ngân vốn đầu tư công năm ${nam}`);
    cdt = await taoViec(db, vbId, `${khoa} Đẩy nhanh giải ngân dự án giao thông`);
    const r = await db.from('gn_nhiem_vu').insert([{ nhiem_vu_id: tt.id, nam, loai: 'TOAN_TINH', muc_tieu_ngay: `${nam}-12-31` },
      { nhiem_vu_id: cdt.id, nam, loai: 'CHU_DAU_TU', ten: CDT, ten_chuan: tenChuan(CDT), muc_tieu_ngay: `${nam}-12-31` }]);
    if (r.error) throw new Error(`Đặt việc theo dõi giải ngân: ${r.error.message}`);
  });
  test.afterAll(async () => { if (db && khoa) await don(); });

  test('Nhập kỳ bằng bảng dán → Tổng quan hiện vòng %, nguồn vốn, chủ đầu tư, mức của nhiệm vụ; ngăn chi tiết có diễn biến', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true });
    const khoi = page.locator('#tqGiaiNgan'); const hop = page.locator('#gnModal');
    await expect(page.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
    await expect(khoi).toContainText(`Giải ngân vốn đầu tư công năm ${nam}`);
    await khoi.locator('[data-action="gnMoNhap"]').click();
    await expect(hop).toBeVisible();
    await page.locator('#gnNgay').fill(ngay);
    await page.locator('#gnCanCu').fill(`${khoa} Báo cáo tình hình giải ngân (dữ liệu kiểm thử)`);
    await dan(page, 'NGUON', { html: BANG_NGUON, text: 'không dùng' });
    await expect(page.locator('#gnKh'), 'số tổng điền từ dòng TỔNG CỘNG, đổi triệu → tỷ').toHaveValue('8.250');
    await expect(page.locator('#gnDa')).toHaveValue('4.450');
    await expect(hop.locator('[data-gn-o="donVi"]')).toHaveValue('trieu');
    await expect(hop.locator('[data-gn-chon="NGUON"]:checked'), 'bốn nguồn được tích, dòng tổng không').toHaveCount(4);
    await page.locator('[data-action="gnTab"][data-loai="CHU_DAU_TU"]').click();
    await dan(page, 'CHU_DAU_TU', { text: BANG_CDT });
    await expect(hop.locator('[data-gn-chon="CHU_DAU_TU"]:checked')).toHaveCount(3);
    await expect(page.locator('#gnCanhBao'), 'tổng chủ đầu tư lệch số tổng — cảnh báo, vẫn cho ghi').toContainText('Tổng các chủ đầu tư, đơn vị (3 dòng) lệch số tổng');
    await page.locator('#gnLuu').click();
    await expect(hop).toBeHidden(NAP);

    await expect(khoi.locator('.gn-vong .giua-vong b')).toHaveText(ptVN(tyLe(4450, 8250)), NAP);
    await expect(khoi.locator('[aria-labelledby="tqGnNguon"] tbody tr')).toHaveCount(4);
    await expect(khoi.locator('[aria-labelledby="tqGnCdt"] tbody tr').first(), 'chủ đầu tư tỷ lệ thấp nhất đứng đầu').toContainText(CDT);
    const m = mucGiaiNgan({ da: 22, kh: 2200, ngaySoLieu: ngay, nam, homNay: ngay });
    const dong = khoi.locator('.bang-gn-viec tbody tr', { hasText: cdt.ma });
    await expect(dong.locator('.muc-gn'), 'mức của nhiệm vụ gắn chủ đầu tư như lib tính').toHaveText(nhanMuc(m));
    await expect(dong).toContainText('1%');

    await khoi.locator(`[data-action="tqMoViec"][data-id="${tt.id}"]`).first().click();
    const muc = page.locator(`#klGiaiNgan-${tt.id}`);
    await expect(muc).toBeVisible(NAP);
    await expect(muc).toContainText('Số liệu toàn tỉnh');
    await expect(muc).toContainText('Diễn biến qua 1 kỳ số liệu');
    await expect(page.locator(`#klDienBien-${tt.id}`)).toContainText('Giải ngân vốn', NAP);
    await page.context().close();
  });
});
