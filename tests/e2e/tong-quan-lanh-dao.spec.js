// v3.24 — Tổng quan cho lãnh đạo (bố cục 9 khối, chủ dự án duyệt 16/10/2026) và mục tiêu then chốt (0105–0106). (1) Chánh VP: 9 khối đúng thứ tự
// và số khối; lọc nhanh → chip "Đang áp dụng" → "Mở danh sách theo bộ lọc này" ra đúng số đang lọc → bỏ chip; bộ lọc chi tiết mở / gập, nhớ theo
// máy sau tải lại (điều kiện lọc không nhớ); khối 3 mở một khối ra các ngành, số "Toàn bộ" = danh sách; khối 9 gập sẵn, mở được, nhớ sau tải lại.
// (2) Trưởng phòng giao việc từ văn bản mới có mục tiêu ở "Thông tin thêm" → văn bản mang mục tiêu, việc tính theo văn bản; ngăn chi tiết: chip
// "theo văn bản", bút → gắn riêng cho việc (DB + lịch sử) → "Lưu cho cả văn bản" (mặc định văn bản đổi, việc bỏ gắn riêng); danh sách Nhiệm vụ lọc
// theo mục tiêu; khối 2 của Tổng quan mở đúng việc. (3) Chuyên viên chủ trì thấy mục tiêu, không có bút. Dữ liệu theo khoá riêng, tự dọn.
import { test, expect } from '@playwright/test';
import { pageAs, moGiaoViec, moViec, nav, NAP } from './lib/app.js';
import { khoaRieng, donVanBan, donNhiemVuTheoNoiDung } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, voiPhien } from './lib/pr2b.mjs';

const KHOI = ['tqNghen', 'tqMucTieu', 'tqLinhVuc', 'tqXepHang', 'tqThang', 'tqVanBan', 'tqChiDao', 'tqChatLuong', 'tqNoiBo'];
// Đọc số và bấm TRONG CÙNG một lượt JS (realtime có thể vẽ lại giữa hai bước) — như ngan-chi-tiet.spec.js.
const docVaBam = (page, docSel, bamSel = docSel) => page.evaluate(([d, b]) => {
  const o = globalThis.document.querySelector(d);
  const n = Number((o.querySelector('b')?.textContent || o.textContent || '0').replace(/\D/g, '') || 0);
  globalThis.document.querySelector(b).click(); return n;
}, [docSel, bamSel]);
const maCua = (ds) => ds.map((x) => x.muc_tieu_ma);

test.describe.serial('Tổng quan cho lãnh đạo và mục tiêu then chốt (v3.24)', () => {
  test.describe.configure({ timeout: 150_000 });
  let db; let khoa; let vb; let nv;
  const soVb = () => `${khoa}-MT`;
  const don = async () => { await donNhiemVuTheoNoiDung(db, khoa); await donVanBan(db, soVb()); };
  test.beforeAll(async () => {
    db = dbAdmin(); khoa = khoaRieng('TQLD', test.info());
    test.skip(Boolean((await db.from('dm_muc_tieu').select('ma').limit(1)).error), 'Project chưa có migration 0105.');
    await don();
  });
  test.afterAll(async () => { if (db) await don(); });

  test('1. Chánh VP: 9 khối; lọc nhanh, chip, mở danh sách theo bộ lọc; bộ lọc chi tiết nhớ theo máy; khối 3 mở ngành; khối 9 gập sẵn', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true });
    const tq = page.locator('#viewTongQuan'); const ngan = page.locator('#nganCT'); const viec = ngan.locator('.nct-viec');
    const dong = async () => { await page.keyboard.press('Escape'); await expect(ngan).toBeHidden(); };
    await expect(tq).toHaveAttribute('data-nap', /./, NAP);
    const thuTu = await tq.evaluate((el, ids) => {
      const id = [...el.querySelectorAll(':scope > .luoi-tq > [id]')].map((x) => x.id).filter((x) => ids.includes(x));
      return { id, so: ids.map((x) => el.querySelector(`#${x} .so-khoi`)?.textContent) };
    }, KHOI);
    expect(thuTu.id, 'chín khối theo đúng thứ tự bố cục').toEqual(KHOI);
    expect(thuTu.so).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);

    // Lọc nhanh → chip → danh sách theo bộ lọc đúng số đang lọc → bỏ chip.
    const nhanh = page.locator('#tqLoc [data-action="tqNhanh"][data-n="qh30"]');
    await nhanh.click();
    await expect(nhanh).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#tqLoc .chip-tq')).toContainText('Quá hạn trên 30 ngày');
    await expect(page.locator('#tqDangLoc')).toContainText('Đang lọc');
    const so = await docVaBam(page, '#tqDangLoc', '#tqMoTheoLoc');
    await expect(ngan).toBeVisible();
    await expect(viec, 'danh sách theo bộ lọc = số đang lọc').toHaveCount(so);
    await dong();
    await page.locator('#tqLoc .chip-tq button[data-k="nhanh"]').click();
    await expect(page.locator('#tqLoc .chip-tq')).toHaveCount(0);
    await expect(page.locator('#tqDangLoc')).not.toContainText('Đang lọc');

    // Bộ lọc chi tiết: mở, chọn một trạng thái → chip; tải lại: lưới vẫn mở (nhớ theo máy), điều kiện lọc không nhớ; gập lại.
    await page.locator('#tqLocChiTietNut').click();
    await expect(page.locator('#tqLocLuoi')).toBeVisible();
    await expect(page.locator('#tqLocChiTietNut')).toHaveAttribute('aria-expanded', 'true');
    const tt = await page.locator('#tqLocTrangThai option:not([value=""])').first().getAttribute('value');
    await page.locator('#tqLocTrangThai').selectOption(tt);
    await expect(page.locator('#tqLoc .chip-tq')).toContainText('Trạng thái:');
    await expect(page.locator('#tqLocTrangThai')).toHaveValue(tt);
    await page.reload();
    await expect(tq).toHaveAttribute('data-nap', /./, NAP);
    await expect(page.locator('#tqLocLuoi')).toBeVisible();
    await expect(page.locator('#tqLocTrangThai')).toHaveValue('');
    await page.locator('#tqLocChiTietNut').click();
    await expect(page.locator('#tqLocLuoi')).toBeHidden();

    // Khối 3: mở một khối ra các ngành; số "Toàn bộ" = danh sách mở ra.
    const kv = page.locator('#tqLinhVuc .kv-mo').first();
    const maKv = await kv.getAttribute('data-ma');
    await kv.click();
    await expect(page.locator(`#tqLinhVuc .kv-mo[data-ma="${maKv}"]`)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#tqLinhVuc .kv-hang.con, #tqLinhVuc .kv-trong').first()).toBeVisible();
    const tong = await docVaBam(page, '#tqLinhVuc .kv-hang.tong .kv-so.ten-bam');
    await expect(viec, 'khối 3 — Toàn bộ').toHaveCount(tong);
    await dong();

    // Khối 9: gập sẵn với lãnh đạo Văn phòng; mở → nhớ sau tải lại; gập lại.
    const nut = page.locator('#tqNoiBoNut');
    await expect(nut).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#tqNoiBoThan')).toBeHidden();
    await nut.click();
    await expect(page.locator('#tqNoiBoThan')).toBeVisible();
    await page.reload();
    await expect(tq).toHaveAttribute('data-nap', /./, NAP);
    await expect(page.locator('#tqNoiBoNut')).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#tqNoiBoNut').click();
    await expect(page.locator('#tqNoiBoThan')).toBeHidden();
    await page.context().close();
  });

  test('2. Trưởng phòng: giao từ văn bản mới có mục tiêu → văn bản mang mục tiêu; ngăn chi tiết gắn riêng, lưu cho cả văn bản; lọc Nhiệm vụ; khối 2', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'A2', testInfo, async (p) => {
      await moGiaoViec(p);
      await p.locator('#klThVanBan').selectOption('__moi__'); await p.locator('#klThLoaiVB').selectOption('CONG_VAN');
      await p.locator('#klThSoKL').fill(soVb()); await p.locator('#klThNgayBH').fill(cong(homNay(), -1));
      await p.locator('#klThNoiDung').fill(`${khoa} việc 1`); await p.locator('#klThOwner').selectOption(`tk:${ID.cv1}`);
      await p.locator('#klThSanPham').selectOption('BAO_CAO'); await p.locator('#klThHan').fill(cong(homNay(), 20));
      await p.locator('#gvThemWrap summary').click();
      await expect(p.locator('#gvMucTieuWrap')).toBeVisible();
      await p.locator('#gvMucTieu input[value="CTR_DU_LICH"]').check();
      await expect(p.locator('#gvMucTieuGhiChu')).toContainText('văn bản mới');
      await expect(p.locator('#gvConThieu')).toHaveText('', NAP);
      await p.locator('#klThLuu').click();
      await expect(p.locator('#toastContainer')).toContainText('Đã giao việc', NAP);
      vb = (await db.from('van_ban_giao_viec').select('id').eq('so_ket_luan', soVb()).single()).data;
      nv = (await db.from('nhiem_vu').select('id, ma').eq('van_ban_id', vb.id).single()).data;
      expect(maCua((await db.from('van_ban_muc_tieu').select('muc_tieu_ma').eq('van_ban_id', vb.id)).data)).toEqual(['CTR_DU_LICH']);
      expect((await db.from('nhiem_vu_muc_tieu').select('muc_tieu_ma').eq('nhiem_vu_id', nv.id)).data).toEqual([]);

      // Ngăn chi tiết (mở sẵn sau khi giao): việc tính theo văn bản → bút → gắn riêng thêm Nghị quyết 57.
      const ngan = p.locator('#nganCT'); const o = ngan.locator('.ct-mt');
      await expect(o).toContainText('Du lịch bền vững', NAP); await expect(o).toContainText('theo văn bản');
      await o.locator('.nut-tang').click();
      const form = p.locator(`#oMt-${nv.id}`);
      await expect(form).toBeVisible();
      await expect(form.locator('input[value="CTR_DU_LICH"]')).toBeChecked();
      await form.locator('input[value="NQ_57"]').check();
      await form.getByRole('button', { name: 'Lưu cho việc này' }).click();
      await expect(p.locator('#toastContainer')).toContainText('Đã gắn 2 mục tiêu then chốt', NAP);
      await expect(o).toContainText('Nghị quyết 57-NQ/TW', NAP); await expect(o).not.toContainText('theo văn bản');
      expect(maCua((await db.from('nhiem_vu_muc_tieu').select('muc_tieu_ma').eq('nhiem_vu_id', nv.id).order('muc_tieu_ma')).data)).toEqual(['CTR_DU_LICH', 'NQ_57']);
      const ls = (await db.from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', nv.id).eq('cot', 'gan_muc_tieu').order('luc')).data;
      expect(ls.map((x) => x.gia_tri_moi).join(' | ')).toContain('Gắn mục tiêu then chốt:');

      // Lưu cho cả văn bản: mặc định văn bản = lựa chọn mới, việc bỏ gắn riêng → tính theo văn bản.
      await o.locator('.nut-tang').click();
      await expect(form).toBeVisible();
      await form.locator('input[value="DP_CAN_BO"]').check();
      await form.getByRole('button', { name: 'Lưu cho cả văn bản' }).click();
      await expect(p.locator('#toastContainer')).toContainText('tính theo văn bản', NAP);
      await expect(o).toContainText('Đột phá cán bộ', NAP); await expect(o).toContainText('theo văn bản');
      expect(maCua((await db.from('van_ban_muc_tieu').select('muc_tieu_ma').eq('van_ban_id', vb.id).order('muc_tieu_ma')).data)).toEqual(['CTR_DU_LICH', 'DP_CAN_BO', 'NQ_57']);
      expect((await db.from('nhiem_vu_muc_tieu').select('muc_tieu_ma').eq('nhiem_vu_id', nv.id)).data).toEqual([]);
      await p.keyboard.press('Escape'); await expect(ngan).toBeHidden();

      // Danh sách Nhiệm vụ: ô lọc mục tiêu trong "Thêm bộ lọc".
      await nav(p, 'navKl');
      await expect(p.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
      await p.locator('#klTimKiem').fill(khoa);
      const row = p.locator(`#klRow-${nv.id}`); await expect(row).toBeVisible(NAP);
      await p.locator('.kl-them summary').click();
      await p.locator('#klLocMucTieu').selectOption('DP_CAN_BO');
      await expect(row).toBeVisible(); await expect(p.locator('#klSoLocThem')).toContainText('1 đang áp dụng');
      if (await p.locator('#klLocMucTieu option[value="CHUA"]').count()) {
        await p.locator('#klLocMucTieu').selectOption('CHUA');
        await expect(row).toHaveCount(0);
      }
      await p.locator('#klLocMucTieu').selectOption('');
      await expect(row).toBeVisible();

      // Tổng quan khối 2: thẻ đột phá cán bộ và dòng Nghị quyết 57 mở danh sách có việc vừa giao. Mở lại màn vẽ ngay bằng số cũ rồi mới nạp
      // lại — chờ data-nap đổi (lần nạp mới có mục tiêu vừa gắn) trước khi bấm.
      const napCu = await p.locator('#viewTongQuan').getAttribute('data-nap');
      await nav(p, 'navTongQuan');
      if (napCu) await expect(p.locator('#viewTongQuan')).not.toHaveAttribute('data-nap', napCu, NAP);
      await expect(p.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
      await p.locator('#tqMucTieu .the-mt').filter({ hasText: 'Nâng cao chất lượng đội ngũ cán bộ' }).click();
      await expect(ngan.locator('.nct-viec').filter({ hasText: `${khoa} việc 1` })).toHaveCount(1, NAP);
      await p.keyboard.press('Escape'); await expect(ngan).toBeHidden();
      await p.locator('#tqMucTieu [data-action="tqTabMt"][data-tab="NQ_TW"]').click();
      await p.locator('#tqMucTieu .ten-bam').filter({ hasText: 'Nghị quyết 57-NQ/TW' }).click();
      await expect(ngan.locator('.nct-viec').filter({ hasText: `${khoa} việc 1` })).toHaveCount(1, NAP);
    });
  });

  test('3. Chuyên viên chủ trì: thấy mục tiêu của việc (theo văn bản), không có bút gắn mục tiêu', async ({ browser }, testInfo) => {
    test.skip(!nv, 'Bước 2 chưa tạo được việc.');
    await voiPhien(browser, 'A3', testInfo, async (p) => {
      await moViec(p, nv.id, nv.ma);
      const o = p.locator(`#klChiTiet-${nv.id} .ct-mt`);
      await expect(o).toContainText('Đột phá cán bộ', NAP); await expect(o).toContainText('theo văn bản');
      await expect(o.locator('.nut-tang')).toHaveCount(0);
      await expect(p.locator(`#oMt-${nv.id}`)).toHaveCount(0);
    });
  });
});
