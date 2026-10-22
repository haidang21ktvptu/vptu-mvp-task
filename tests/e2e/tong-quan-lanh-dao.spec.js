// v3.24 — Tổng quan cho lãnh đạo (bố cục 9 khối, chủ dự án duyệt 16/10/2026) và mục tiêu then chốt (0105–0106). (1) Chánh VP: 9 khối đúng thứ tự
// và số khối; lọc nhanh → chip "Đang áp dụng" → "Mở danh sách theo bộ lọc này" ra đúng số đang lọc → bỏ chip; bộ lọc chi tiết mở / gập, nhớ theo
// máy sau tải lại (điều kiện lọc không nhớ); khối 3 mở một khối ra các ngành, số "Toàn bộ" = danh sách; khối 9 gập sẵn, mở được, nhớ sau tải lại.
// (2) Trưởng phòng giao việc từ văn bản mới, chọn mục tiêu của văn bản ở khối 1 (v3.25: ô chọn có gợi ý, "Chọn thêm từ danh mục") → văn bản mang
// mục tiêu, việc tính theo văn bản; ngăn chi tiết: chip "theo văn bản", bút → gắn riêng cho việc (DB + lịch sử) → "Lưu cho cả văn bản" (mặc định
// văn bản đổi, việc bỏ gắn riêng); danh sách Nhiệm vụ lọc
// theo mục tiêu; khối 2 của Tổng quan mở đúng việc. (3) Chuyên viên chủ trì thấy mục tiêu, không có bút. Dữ liệu theo khoá riêng, tự dọn.
// v3.27 (chủ dự án 20/10/2026): mục tiêu then chốt tạm ẩn (HIEN_MUC_TIEU) — khối "Theo chủ trì theo dõi" (tổng cộng = cộng các dòng; bấm tên → danh
// sách = cột Tổng); khối Chất lượng ẩn khi chưa có việc được xếp loại; bước 2–3 (mục tiêu) bỏ qua có ghi lý do. v3.28: khối Giải ngân vốn (tuỳ có
// số liệu) ngay sau điểm nghẽn; số khối đánh theo các khối đang hiện, luôn liền nhau.
import { test, expect } from '@playwright/test';
import { pageAs, moGiaoViec, moViec, nav, NAP, chonPhanLoai, HIEN_MUC_TIEU, LY_DO_AN_MT } from './lib/app.js';
import { khoaRieng, donVanBan, donNhiemVuTheoNoiDung } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, voiPhien } from './lib/pr2b.mjs';

const KHOI = ['tqNghen', 'tqGiaiNgan', HIEN_MUC_TIEU ? 'tqMucTieu' : 'tqChuTri', 'tqLinhVuc', 'tqXepHang', 'tqThang', 'tqVanBan', 'tqChiDao', 'tqChatLuong', 'tqNoiBo'];
const TUY_CHON = ['tqGiaiNgan', 'tqChatLuong'];   // v3.28: Giải ngân vốn (ẩn khi chưa có số liệu, trừ lãnh đạo / người nhập), Chất lượng (v3.27) — khối ẩn không làm hụt số
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

  test('1. Chánh VP: 9 khối (8 khi chưa có việc xếp loại); khối 2; lọc nhanh, chip, danh sách theo bộ lọc; bộ lọc chi tiết nhớ theo máy; khối 3; khối nội bộ gập sẵn', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true });
    const tq = page.locator('#viewTongQuan'); const ngan = page.locator('#nganCT'); const viec = ngan.locator('.nct-viec');
    const dong = async () => { await page.keyboard.press('Escape'); await expect(ngan).toBeHidden(); };
    await expect(tq).toHaveAttribute('data-nap', /./, NAP);
    const thuTu = await tq.evaluate((el, ids) => {
      const id = [...el.querySelectorAll(':scope > .luoi-tq > [id]')].map((x) => x.id).filter((x) => ids.includes(x));
      return { id, so: id.map((x) => el.querySelector(`#${x} .so-khoi`)?.textContent) };
    }, KHOI);
    const mong = KHOI.filter((x) => !TUY_CHON.includes(x) || thuTu.id.includes(x));
    expect(thuTu.id, 'các khối theo đúng thứ tự bố cục').toEqual(mong);
    expect(thuTu.so, 'số khối liền nhau').toEqual(mong.map((_, i) => String(i + 1)));

    if (!HIEN_MUC_TIEU) {   // v3.27: khối 2 "Theo chủ trì theo dõi" — tổng = hoàn thành + đang thực hiện + quá hạn; tổng cộng = cộng các dòng; bấm tên → cột Tổng
      const bang = await page.locator('#tqChuTri').evaluate((el) => {
        const n = (o) => Number((o?.textContent || '0').replace(/\D/g, '') || 0);
        return { dong: [...el.querySelectorAll('tbody tr')].map((tr) => ['Tổng', 'Hoàn thành', 'Đang thực hiện', 'Quá hạn'].map((c) => n(tr.querySelector(`td[data-n="${c}"]`)))),
          chan: [...el.querySelectorAll('tfoot td.so')].map(n) };
      });
      expect(bang.dong.length, 'khối 2 có số liệu').toBeGreaterThan(0);
      for (const [t, x, d, q] of bang.dong) expect(t, 'Tổng = Hoàn thành + Đang thực hiện + Quá hạn').toBe(x + d + q);
      expect(bang.chan, 'dòng Tổng cộng').toEqual([0, 1, 2, 3].map((i) => bang.dong.reduce((s, d) => s + d[i], 0)));
      const soCt = await docVaBam(page, '#tqChuTri tbody tr:first-child td[data-n="Tổng"]', '#tqChuTri tbody tr:first-child .ten-bam');
      await expect(viec, 'khối 2 — danh sách của chủ trì = cột Tổng').toHaveCount(soCt, NAP);
      await dong();
    }

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

    // Khối nội bộ (9, hoặc 8 khi khối Chất lượng ẩn): gập sẵn với lãnh đạo Văn phòng; mở → nhớ sau tải lại; gập lại.
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
    test.skip(!HIEN_MUC_TIEU, LY_DO_AN_MT);
    await voiPhien(browser, 'A2', testInfo, async (p) => {
      await moGiaoViec(p);
      await p.locator('#klThVanBan').selectOption('__moi__'); await p.locator('#klThLoaiVB').selectOption('CONG_VAN');
      await p.locator('#klThSoKL').fill(soVb()); await p.locator('#klThNgayBH').fill(cong(homNay(), -1));
      await p.locator('#klThNoiDung').fill(`${khoa} việc 1`); await p.locator('#klThOwner').selectOption(`tk:${ID.cv1}`);
      await p.locator('#klThSanPham').selectOption('BAO_CAO'); await p.locator('#klThHan').fill(cong(homNay(), 20));
      // v3.25: mục tiêu của văn bản mới ở khối 1 — chọn từ danh mục; thẻ 1 hiện mục đó "theo văn bản".
      const oVb = p.locator('#gvMtVb .mtg');
      await expect(oVb).toBeVisible(NAP);
      await oVb.locator('[data-action="mtgMoDm"]').click();
      await oVb.locator('input[data-mtg-chon][value="CTR_DU_LICH"]').check();
      await expect(oVb.locator('.mtg-chip')).toContainText('Du lịch bền vững');
      await expect(p.locator('#gvThe1 .mtg-chip[data-nguon="VAN_BAN"]')).toContainText('Du lịch bền vững', NAP);
      await expect(p.locator('#gvConThieu')).toContainText('ngành/lĩnh vực (hoặc "Không thuộc")');   // v3.26: bắt buộc phân loại (v3.29: lĩnh vực tự xác định)
      await chonPhanLoai(p);   // công văn: ngành "Không thuộc"; mục tiêu đã có (theo văn bản) — không tích "Không thuộc"
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
      await expect(form.locator('.mtg-chip')).toContainText('Du lịch bền vững');
      await form.locator('[data-action="mtgMoDm"]').click();
      await expect(form.locator('input[data-mtg-chon][value="CTR_DU_LICH"]')).toBeChecked();
      await form.locator('input[data-mtg-chon][value="NQ_57"]').check();
      await form.getByRole('button', { name: 'Lưu cho việc này' }).click();
      await expect(p.locator('#toastContainer')).toContainText('Đã gắn 2 mục tiêu then chốt', NAP);
      await expect(o).toContainText('Nghị quyết 57-NQ/TW', NAP); await expect(o).not.toContainText('theo văn bản');
      expect(maCua((await db.from('nhiem_vu_muc_tieu').select('muc_tieu_ma').eq('nhiem_vu_id', nv.id).order('muc_tieu_ma')).data)).toEqual(['CTR_DU_LICH', 'NQ_57']);
      const ls = (await db.from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', nv.id).eq('cot', 'gan_muc_tieu').order('luc')).data;
      expect(ls.map((x) => x.gia_tri_moi).join(' | ')).toContain('Gắn mục tiêu then chốt:');
      const ng = (await db.from('nhiem_vu_muc_tieu').select('muc_tieu_ma, nguon').eq('nhiem_vu_id', nv.id)).data;
      expect(ng.find((x) => x.muc_tieu_ma === 'NQ_57')?.nguon, 'v3.25: chọn từ danh mục → nguồn người chọn').toBe('CHON');

      // Lưu cho cả văn bản: mặc định văn bản = lựa chọn mới, việc bỏ gắn riêng → tính theo văn bản.
      await o.locator('.nut-tang').click();
      await expect(form).toBeVisible();
      await form.locator('[data-action="mtgMoDm"]').click();
      await form.locator('input[data-mtg-chon][value="DP_CAN_BO"]').check();
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
    test.skip(!HIEN_MUC_TIEU, LY_DO_AN_MT);
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
