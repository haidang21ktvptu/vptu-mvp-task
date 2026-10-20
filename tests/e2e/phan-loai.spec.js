// v3.26 (0116) — phân loại nhiệm vụ cho Tổng quan khối 2–3 (chủ dự án 19/10/2026). (1) Trưởng phòng giao việc từ công văn mới: dòng nhắc, "Còn thiếu"
// ghi ngành – lĩnh vực và mục tiêu then chốt; ô ngành có "Không thuộc ngành, lĩnh vực nào" (tự chọn lĩnh vực duy nhất) — đổi sang Kết luận BTV thì mục
// đó không còn; ô mục tiêu: "Không thuộc" và mục thật loại trừ nhau (hai chiều); giao → DB ghi ngành KHONG_THUOC / LV99, mục tiêu KHONG_THUOC (người
// chọn). (2) Chánh VP: Tổng quan khối 3 có dòng "Không thuộc lĩnh vực trọng tâm" (mở ra việc vừa giao) và "Chưa phân loại — cần rà soát" → nút "Rà
// soát phân loại" mở trang Rà soát ở ô "Chưa có ngành, lĩnh vực"; khối 2 ghi số "không thuộc". (3) Rà soát bằng tệp: Xuất tệp rà soát (danh sách đang
// lọc) → đọc lại bằng bộ đọc của app, điền ngành / lĩnh vực / mục tiêu theo TÊN, ghi bằng bộ ghi của app → Chọn tệp → xem trước (đổi / lỗi, chưa ghi)
// → Áp dụng: việc đang mở và việc ĐÃ HOÀN THÀNH đổi phân loại (mục tiêu nguồn RA_SOAT), diễn biến có lý do, không gửi tin. Dữ liệu theo khoá riêng,
// tự dọn. Chạy một mình (project v326-phan-loai, nối sau v325-ra-soat) vì đọc số toàn Văn phòng và ghi phân loại.
// v3.27: mục tiêu then chốt tạm ẩn (HIEN_MUC_TIEU) — phần mục tiêu chỉ chạy khi bật; tệp rà soát không có cột mục tiêu.
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { pageAs, moGiaoViec, nav, NAP, HIEN_MUC_TIEU } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan, donNhiemVuTheoNoiDung } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, voiPhien, taoViec } from './lib/pr2b.mjs';
import { docXlsx } from '../../frontend/src/lib/xlsx-doc.js';
import { taoXlsx } from '../../frontend/src/lib/xlsx.js';

const KT_NGANH = 'Không thuộc ngành, lĩnh vực nào'; const KT_MT = 'Không thuộc mục tiêu then chốt';
const TIEU_DE = ['Mã nhiệm vụ', 'Nội dung nhiệm vụ', 'Văn bản', 'Chủ trì', 'Tiến độ', 'Ngành', 'Lĩnh vực', ...(HIEN_MUC_TIEU ? ['Mục tiêu then chốt'] : []), 'Lý do rà soát'];
const ab = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

test.describe.serial('Phân loại nhiệm vụ — bắt buộc khi giao, "Không thuộc", rà soát bằng tệp (v3.26)', () => {
  test.describe.configure({ timeout: 150_000 });
  let db; let khoa; let vbRs; let vMo; let vXong; let nd1; let ten;
  const soGiao = () => `${khoa}-GV`; const soRs = () => `${khoa}-RS`;
  const don = async () => { await donNhiemVuTheoNoiDung(db, khoa); await donVanBan(db, soGiao()); await donVanBan(db, soRs()); };
  test.beforeAll(async () => {
    db = dbAdmin(); khoa = khoaRieng('PL', test.info()); nd1 = `${khoa} việc không thuộc`;
    test.skip(((await db.from('dm_nganh').select('ma').eq('ma', 'KHONG_THUOC')).data || []).length !== 1, 'Project chưa có migration 0116.');
    await don();
    vbRs = await taoVanBanRieng(db, soRs(), { loai: 'CONG_VAN' });
    vMo = await taoViec(db, vbRs, `${khoa} việc chưa phân loại`, { nganh_ma: null });
    vXong = await taoViec(db, vbRs, `${khoa} việc đã hoàn thành`, { linh_vuc_ma: 'LV08_TAI_CHINH', han_xu_ly: cong(homNay(), -5), tien_do_ma: 'HOAN_THANH',
      ngay_hoan_thanh: cong(homNay(), -6), minh_chung: `${khoa}/cũ`, theo_1400: false, ngay_nhan_van_ban: cong(homNay(), -30) });
    const t = async (bang, cot, ma) => (await db.from(bang).select(cot).eq('ma', ma).single()).data[cot];
    ten = { ktth: await t('dm_nganh', 'ten', 'KINH_TE_TONG_HOP'), lv08: await t('dm_linh_vuc', 'ten', 'LV08_TAI_CHINH'), vhxh: await t('dm_nganh', 'ten', 'VAN_HOA_XA_HOI'),
      lv10: await t('dm_linh_vuc', 'ten', 'LV10_VAN_HOA'), nq80: await t('dm_muc_tieu', 'ten_ngan', 'NQ_80') };
  });
  test.afterAll(async () => { if (db && khoa) await don(); });

  test('1. Giao việc: bắt buộc phân loại; "Không thuộc" ở ngành (trừ kết luận / thông báo) và mục tiêu; DB ghi đúng', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'A2', testInfo, async (p) => {
      await moGiaoViec(p);
      await p.locator('#klThVanBan').selectOption('__moi__'); await p.locator('#klThLoaiVB').selectOption('CONG_VAN');
      await p.locator('#klThSoKL').fill(soGiao()); await p.locator('#klThNgayBH').fill(cong(homNay(), -1));
      await p.locator('#klThNoiDung').fill(nd1); await p.locator('#klThOwner').selectOption(`tk:${ID.cv1}`);
      await p.locator('#klThSanPham').selectOption('BAO_CAO'); await p.locator('#klThHan').fill(cong(homNay(), 20));
      const thieu = p.locator('#gvConThieu'); const luu = p.locator('#klThLuu');
      await expect(p.locator('#gvNhacPhanLoai')).toContainText('bắt buộc chọn');
      await expect(thieu).toContainText('ngành (hoặc "Không thuộc"), lĩnh vực', NAP);
      if (HIEN_MUC_TIEU) await expect(thieu).toContainText('mục tiêu then chốt (hoặc "Không thuộc")');
      await expect(luu).toBeDisabled();

      // Ngành "Không thuộc" → lĩnh vực duy nhất tự chọn
      await p.locator('#klThNganh').selectOption('KHONG_THUOC');
      await expect(p.locator('#klThLinhVuc')).toHaveValue('LV99_KHONG_THUOC');
      await expect(thieu).toHaveText(HIEN_MUC_TIEU ? 'Còn thiếu: mục tiêu then chốt (hoặc "Không thuộc")' : '', NAP);

      // Mục tiêu: "Không thuộc" ⇄ mục thật loại trừ nhau (v3.27: chỉ khi mục tiêu không bị ẩn)
      if (HIEN_MUC_TIEU) {
      const o = p.locator('#gvThe1 .mtg').first(); const chip = o.locator('[data-mtg-phan="chon"] .mtg-chip');
      await o.locator('[data-mtg-khong]').check();
      await expect(chip).toHaveCount(1); await expect(chip).toHaveAttribute('data-nguon', 'KHONG'); await expect(thieu).toHaveText('', NAP);
      await o.locator('[data-action="mtgMoDm"]').click();
      await o.locator('input[data-mtg-chon][value="NQ_57"]').check();
      await expect(o.locator('[data-mtg-khong]')).not.toBeChecked();
      await expect(chip).toHaveCount(1); await expect(chip).toContainText('Nghị quyết 57-NQ/TW');
      await o.locator('[data-mtg-khong]').check();
      await expect(chip).toHaveCount(1); await expect(chip).toHaveAttribute('data-nguon', 'KHONG');
      }

      // Kết luận BTV: ô ngành không có "Không thuộc" (quy tắc 1400); về công văn thì có lại
      await p.locator('#klThLoaiVB').selectOption('KL_BTV');
      await expect(p.locator('#klThNganh option[value="KHONG_THUOC"]')).toHaveCount(0);
      await expect(p.locator('#klThNganh')).toHaveValue('');
      await expect(thieu).toContainText('ngành, lĩnh vực'); await expect(thieu).not.toContainText('ngành (hoặc');
      await p.locator('#klThLoaiVB').selectOption('CONG_VAN');
      await expect(p.locator('#klThNganh option[value="KHONG_THUOC"]')).toHaveCount(1);
      await p.locator('#klThNganh').selectOption('KHONG_THUOC'); await expect(p.locator('#klThLinhVuc')).toHaveValue('LV99_KHONG_THUOC');
      await expect(thieu).toHaveText('', NAP); await expect(luu).toBeEnabled();
      await luu.click();
      await expect(p.locator('#toastContainer')).toContainText('Đã giao việc NV-', NAP);
    });
    const v = (await db.from('nhiem_vu').select('id, nganh_ma, linh_vuc_ma').eq('noi_dung', nd1).single()).data;
    expect([v.nganh_ma, v.linh_vuc_ma]).toEqual(['KHONG_THUOC', 'LV99_KHONG_THUOC']);
    await expect.poll(async () => (await db.from('nhiem_vu_muc_tieu').select('muc_tieu_ma, nguon').eq('nhiem_vu_id', v.id)).data, NAP)
      .toEqual(HIEN_MUC_TIEU ? [{ muc_tieu_ma: 'KHONG_THUOC', nguon: 'CHON' }] : []);
  });

  test('2. Chánh VP — Tổng quan: khối 3 tách "Không thuộc" / "Chưa phân loại" (mở Rà soát đúng ô lọc); khối 2 ghi số không thuộc', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true });
    const ngan = page.locator('#nganCT');
    await expect(page.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
    const kt = page.locator('#tqLinhVuc .kv-hang.chua').filter({ hasText: 'Không thuộc lĩnh vực trọng tâm' });
    await expect(kt).toHaveCount(1);
    await kt.locator('.kv-so.ten-bam').click();
    await expect(ngan.locator('.nct-viec').filter({ hasText: nd1 })).toHaveCount(1, NAP);
    await page.keyboard.press('Escape'); await expect(ngan).toBeHidden();
    if (HIEN_MUC_TIEU) {   // v3.27: khối 2 mục tiêu tạm thay bằng "Theo chủ trì theo dõi"
      const pl = page.locator('#tqMtPhanLoai');
      await expect(pl).toContainText('không thuộc mục tiêu then chốt');
      expect(Number((await pl.innerText()).match(/(\d+)\s+không thuộc mục tiêu then chốt/)?.[1] || 0), 'khối 2: số việc "Không thuộc"').toBeGreaterThanOrEqual(1);
    }
    await expect(page.locator('#tqLinhVuc .kv-hang.chua').filter({ hasText: 'Chưa phân loại — cần rà soát' })).toHaveCount(1);
    await page.locator('#tqLinhVuc [data-action="moRaSoatMucTieu"][data-che="nganh"]').click();
    await expect(page.locator('#viewRaSoatMucTieu')).toBeVisible();
    await expect(page.locator('#rsDs')).toHaveAttribute('data-nap', /./, NAP);
    await expect(page.locator('#rsChe [data-che="nganh"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#rsVanBan').selectOption(vbRs);
    await expect(page.locator(`#rsDong-${vMo.id} .rs-nganh`)).toHaveText('Chưa phân loại ngành, lĩnh vực', NAP);
    await expect(page.locator(`#rsDong-${vXong.id}`), 'việc đã có ngành, lĩnh vực không ở ô này').toHaveCount(0);
    await page.context().close();
  });

  test('3. Rà soát bằng tệp: xuất → điền theo tên → xem trước (chưa ghi) → Áp dụng; sửa cả việc đã hoàn thành, có diễn biến, không gửi tin', async ({ browser }, testInfo) => {
    const tin = async () => (await db.from('direct_messages').select('id', { count: 'exact', head: true }).in('nhiem_vu_id', [vMo.id, vXong.id])).count;
    const tinTruoc = await tin(); const lyDo = `${khoa} rà soát e2e`;
    await voiPhien(browser, 'A1', testInfo, async (p) => {
      await nav(p, 'navKl');
      await expect(p.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
      await expect(p.locator('#klRaSoatMt')).toHaveText('Rà soát phân loại');
      await p.locator('#klRaSoatMt').click();
      await expect(p.locator('#rsDs')).toHaveAttribute('data-nap', /./, NAP);
      await p.locator('#rsChe [data-che="tat"]').click(); await p.locator('#rsVanBan').selectOption(vbRs);
      await expect(p.locator(`#rsDong-${vMo.id}`)).toBeVisible(NAP); await expect(p.locator(`#rsDong-${vXong.id}`)).toBeVisible();

      // Xuất (danh sách đang lọc) → đọc lại bằng bộ đọc của app
      await p.locator('#rsTep summary').click();
      const tai = p.waitForEvent('download');
      await p.locator('[data-action="rsTepXuat"]').click();
      const tep = await tai;
      expect(tep.suggestedFilename()).toMatch(/^vptu-ra-soat-phan-loai-\d{8}\.xlsx$/);
      const bang = (await docXlsx(ab(readFileSync(await tep.path())))).find((s) => s.ten === 'Rà soát phân loại');
      expect(bang.dong[0]).toEqual(TIEU_DE);
      const theoMa = new Map(bang.dong.slice(1).map((d) => [d[0], TIEU_DE.map((_, i) => d[i] ?? '')]));
      expect([...theoMa.keys()].sort()).toEqual([vMo.ma, vXong.ma].sort());
      const hMo = theoMa.get(vMo.ma); const hXong = theoMa.get(vXong.ma); const iMt = TIEU_DE.indexOf('Mục tiêu then chốt');
      expect([hMo[5], iMt >= 0 ? hMo[iMt] : '']).toEqual(['', '']);
      expect([hXong[5], hXong[6]]).toEqual([ten.ktth, ten.lv08]);

      // Điền theo TÊN (như cán bộ chọn ở ô danh sách của tệp); thêm một mã không có và một dòng sai ngành
      const sua = (h, ng, lv, mt, ly) => [...h.slice(0, 5), ng, lv, ...(iMt >= 0 ? [mt] : []), ly];
      const dong = [sua(hMo, KT_NGANH, '', KT_MT, 'không phục vụ lĩnh vực trọng tâm'), sua(hXong, ten.vhxh, ten.lv10, ten.nq80, 'chủ đề văn hoá'),
        sua(['NV-KHONG-CO-0116', `${khoa} mã không có`, '', '', ''], HIEN_MUC_TIEU ? '' : KT_NGANH, '', KT_MT, ''),
        sua(['NV-LOI-TEP-0116', `${khoa} ngành sai`, '', '', ''], 'Ngành không có 0116', '', '', '')];
      const buffer = Buffer.from(taoXlsx([{ ten: 'Rà soát phân loại', cot: TIEU_DE.map((nhan) => ({ nhan })), dong }]));
      await p.locator('#rsTepFile').setInputFiles({ name: `${khoa}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
      const kq = p.locator('#rsTepKq'); const tom = kq.locator('.rs-tep-tom');
      await expect(tom).toContainText('2 việc sẽ đổi', NAP);
      for (const s of ['1 việc đã hoàn thành', '2 lỗi', 'Chưa ghi gì']) await expect(tom).toContainText(s);
      await expect(kq).toContainText('NV-KHONG-CO-0116'); await expect(kq).toContainText('Ngành không có 0116');
      expect((await db.from('nhiem_vu').select('nganh_ma').eq('id', vMo.id).single()).data.nganh_ma, 'xem trước không ghi').toBeNull();

      await p.locator('#rsTepLyDo').fill(lyDo);
      await kq.locator('[data-action="rsTepApDung"][data-bo="0"]').click();
      await expect(p.locator('#toastContainer')).toContainText('Đã cập nhật phân loại 2 việc', NAP);
      await expect(tom).toContainText('Đã áp dụng: 2 việc đổi phân loại');
      await expect(p.locator(`#rsDong-${vMo.id} .rs-nganh`)).toContainText(KT_NGANH, NAP);
    });
    const n = async (id) => (await db.from('nhiem_vu').select('nganh_ma, linh_vuc_ma, tien_do_ma').eq('id', id).single()).data;
    const mt = async (id) => (await db.from('nhiem_vu_muc_tieu').select('muc_tieu_ma, nguon').eq('nhiem_vu_id', id)).data;
    expect(await n(vMo.id)).toMatchObject({ nganh_ma: 'KHONG_THUOC', linh_vuc_ma: 'LV99_KHONG_THUOC' });
    expect(await n(vXong.id)).toEqual({ nganh_ma: 'VAN_HOA_XA_HOI', linh_vuc_ma: 'LV10_VAN_HOA', tien_do_ma: 'HOAN_THANH' });
    expect(await mt(vMo.id)).toEqual(HIEN_MUC_TIEU ? [{ muc_tieu_ma: 'KHONG_THUOC', nguon: 'RA_SOAT' }] : []);
    expect(await mt(vXong.id)).toEqual(HIEN_MUC_TIEU ? [{ muc_tieu_ma: 'NQ_80', nguon: 'RA_SOAT' }] : []);
    for (const v of [vMo, vXong]) {
      const ls = (await db.from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', v.id).eq('cot', 'ra_soat_phan_loai')).data;
      expect(ls, `diễn biến rà soát ${v.ma}`).toHaveLength(1); expect(ls[0].gia_tri_moi).toContain(lyDo);
    }
    expect(await tin(), 'rà soát không gửi tin').toBe(tinTruoc);
  });
});
