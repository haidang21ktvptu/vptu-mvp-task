// v3.17 (Đợt A, yêu cầu 7/10/2026 mục 1, 5, 9; v3.18 gộp bố cục 8/10): Trưởng phòng (demo_truongphong, TONG_HOP) giao NHIỀU nhiệm vụ từ một văn
// bản mới bằng các thẻ nhiệm vụ — thẻ 1 là bộ ô chính (id klTh*), "+ Thêm nhiệm vụ" dựng thẻ 2, 3 (bỏ một thẻ rồi thêm lại; thẻ 2 giao cho chính
// mình) — mỗi thẻ đủ ô của một việc (người theo dõi, phối hợp, độ khẩn, mô tả, cấp nhận, loại hạn riêng), một giao dịch → 3 việc cùng văn bản;
// tìm nhanh ở ô Chịu trách nhiệm (gõ "chính tôi" / tên chuyên viên, bỏ dấu) mở danh sách người khớp + dòng kết quả, tự chọn; nút chọn nhanh
// "Chính tôi"; PCVP giao hai thẻ khác phòng, khác lĩnh vực trong một lượt từ Kết luận BTV mới. Dữ liệu theo khoá; tự dọn.
import { test, expect } from '@playwright/test';
import { NAP, moGiaoViec } from './lib/app.js';
import { khoaRieng, donVanBan, donNhiemVuTheoNoiDung } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, voiPhien } from './lib/pr2b.mjs';

const H = cong(homNay(), 20);
let db; let khoa;
const the = (p, i) => p.locator(`#gvLuoiThan .gv-nv[data-dong="${i}"]`);
const o = (p, i, cot) => the(p, i).locator(`[data-cot="${cot}"]`);

test.describe.serial('Giao việc — nhiều nhiệm vụ từ một văn bản (thẻ đủ ô), giao cho chính mình, tìm nhanh người', () => {
  test.describe.configure({ timeout: 180_000 });
  const don = async () => { await donNhiemVuTheoNoiDung(db, khoa); await donVanBan(db, `${khoa}-GV`); await donVanBan(db, `${khoa}-KL`); };
  test.beforeAll(async () => { db = dbAdmin(); khoa = khoaRieng('GN', test.info()); await don(); });   // dọn cả lượt chạy dở
  test.afterAll(async () => { if (db) await don(); });

  test('1. Thẻ 1 = ô chính; thêm / bỏ → 3 thẻ; thẻ đủ ô; thẻ 2 giao cho chính mình, Khẩn, phối hợp; "Giao 3 việc" → ba việc cùng văn bản, theo dõi / cấp nhận / độ khẩn từng thẻ', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'A2', testInfo, async (p) => {
      await moGiaoViec(p);
      await expect(p.locator('#viewGiaoViec .gv-phan')).toHaveCount(2);   // v3.18: hai khối — văn bản & mốc giao, nhiệm vụ
      await expect(p.locator('#gvPhan1 #klThNgayNhanWrap')).toBeVisible();   // ngày giao ở khối 1 (dùng chung)
      await expect(p.locator('#gvThe1 #klThNoiDung')).toHaveCount(1); await expect(p.locator('#gvThe1 #klThHan')).toHaveCount(1); await expect(p.locator('#gvThe1 #klThNganh')).toHaveCount(1);   // thẻ 1 chứa đủ ô
      await expect(p.locator('#gvThemWrap')).not.toHaveAttribute('open', /./);   // thông tin thêm thu gọn
      await expect(p.locator('#gvLuoiThan .gv-nv')).toHaveCount(0); await expect(p.locator('#gvLuoiDem')).toHaveText('1 / 20 nhiệm vụ');
      await expect(p.locator('#klThLuuTiep')).toBeVisible(); await expect(p.locator('#klThLuu')).toHaveText('Giao việc');
      await p.locator('#gvThemDong').click();
      await expect(p.locator('#klThLuuTiep')).toBeHidden(); await expect(p.locator('#gvLuoiDem')).toHaveText('2 / 20 nhiệm vụ');
      for (const cot of ['noi_dung', 'owner', 'owner_tim', 'theo_doi', 'theo_doi_tim', 'phoi_hop', 'do_khan', 'san_pham', 'san_pham_mo_ta', 'cap_nhan', 'loai', 'han', 'nganh', 'linh_vuc']) await expect(o(p, 2, cot)).toHaveCount(1);
      await expect(o(p, 2, 'theo_doi')).toHaveValue(ID.tp);   // mặc định người giao
      await p.locator('#gvThemDong').click(); await p.locator('#gvThemDong').click();
      await expect(p.locator('#gvLuoiThan .gv-nv')).toHaveCount(3);
      await the(p, 3).locator('.gvl-xoa').click();
      await expect(p.locator('#gvLuoiThan .gv-nv')).toHaveCount(2); await expect(the(p, 3).locator('.gvl-so')).toHaveText('Nhiệm vụ 3');   // đánh số lại
      await expect(p.locator('#klThLuu')).toHaveText('Giao 3 việc'); await expect(p.locator('#klThLuu')).toBeDisabled();
      await p.locator('#klThVanBan').selectOption('__moi__'); await p.locator('#klThLoaiVB').selectOption('CONG_VAN');
      await p.locator('#klThSoKL').fill(`${khoa}-GV`); await p.locator('#klThNgayBH').fill(cong(homNay(), -1));
      await p.locator('#klThNoiDung').fill(`${khoa} dòng 1`); await p.locator('#klThOwner').selectOption(`tk:${ID.cv1}`);
      await p.locator('#klThSanPham').selectOption('BAO_CAO'); await p.locator('#klThHan').fill(cong(H, 1));
      await expect(p.locator('#klThCapNhan')).toHaveValue('TRUONG_PHONG');
      const owners = { 2: `tk:${ID.tp}`, 3: `tk:${ID.cv1}` };
      for (const i of [2, 3]) {
        await o(p, i, 'noi_dung').fill(`${khoa} dòng ${i}`);
        await o(p, i, 'owner').selectOption(owners[i]);
        await o(p, i, 'san_pham').selectOption('BAO_CAO');
        await o(p, i, 'han').fill(cong(H, i));
      }
      await expect(o(p, 2, 'cap_nhan')).toHaveValue('PHO_CHANH_VAN_PHONG');   // cấp nhận = cấp trên của Owner
      await the(p, 2).locator('.dk-chon button[data-gia-tri="KHAN"]').click();
      await o(p, 2, 'phoi_hop').fill('Sở Tài chính'); await o(p, 2, 'san_pham_mo_ta').fill('Báo cáo quý');
      await o(p, 3, 'theo_doi').selectOption(ID.cv1); await o(p, 3, 'cap_nhan').selectOption('THUONG_TRUC');
      await expect(p.locator('#gvConThieu')).toHaveText('', NAP);
      await expect(p.locator('#gvTomTatChu')).toContainText('và 2 việc khác');
      await expect(p.locator('#klThLuu')).toBeEnabled();
      await p.locator('#klThLuu').click();
      await expect(p.locator('#toastContainer')).toContainText('Đã giao 3 việc', NAP);
      await expect(p.locator('#gvLuoiThan .gv-nv')).toHaveCount(0, NAP);   // biểu mẫu mở lại sạch: chỉ thẻ 1
    });
    const { data } = await db.from('nhiem_vu').select('noi_dung, owner_tai_khoan, nguoi_theo_doi, cap_nhan_san_pham, han_xu_ly, van_ban_id, san_pham_loai, do_khan, don_vi_phoi_hop, san_pham_mo_ta')
      .like('noi_dung', `${khoa} dòng%`).order('noi_dung');
    expect(data.length).toBe(3);
    expect(new Set(data.map((x) => x.van_ban_id)).size).toBe(1);
    expect(data.map((x) => [x.owner_tai_khoan, x.cap_nhan_san_pham, x.han_xu_ly, x.san_pham_loai, x.nguoi_theo_doi, x.do_khan, x.don_vi_phoi_hop, x.san_pham_mo_ta])).toEqual([
      [ID.cv1, 'TRUONG_PHONG', cong(H, 1), 'BAO_CAO', ID.tp, 'THUONG', null, null],
      [ID.tp, 'PHO_CHANH_VAN_PHONG', cong(H, 2), 'BAO_CAO', ID.tp, 'KHAN', 'Sở Tài chính', 'Báo cáo quý'],
      [ID.cv1, 'THUONG_TRUC', cong(H, 3), 'BAO_CAO', ID.cv1, 'THUONG', null, null]]);
  });

  test('2. Tìm nhanh: gõ "chinh toi" (bỏ dấu) mở danh sách người khớp + dòng kết quả, chọn chính mình; gõ tên chuyên viên chọn đúng người; xoá chữ đóng danh sách, giữ lựa chọn; nút "Chính tôi"; ở thẻ cũng vậy', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'A2', testInfo, async (p) => {
      await moGiaoViec(p);
      await expect(p.locator('#gvNhanhOwner button', { hasText: 'Chính tôi' })).toBeVisible();
      await p.locator('#klThOwnerTim').fill('chinh toi');
      await expect(p.locator('#klThOwner')).toHaveValue(`tk:${ID.tp}`);
      await expect(p.locator('#klThOwner')).toHaveAttribute('size', /^[2-7]$/);   // danh sách mở
      await expect(p.locator('#klThOwnerWrap .gv-tim-kq')).toContainText('1 người khớp');
      await expect(p.locator('#klThCapNhan')).toHaveValue('PHO_CHANH_VAN_PHONG');   // cấp nhận = cấp trên của chính mình
      await p.locator('#klThOwnerTim').fill('chuyen vien mot');
      await expect(p.locator('#klThOwner')).toHaveValue(`tk:${ID.cv1}`);
      await p.locator('#klThOwnerTim').fill('xyzxyz');
      await expect(p.locator('#klThOwnerWrap .gv-tim-kq')).toContainText('Không ai khớp');
      await p.locator('#klThOwnerTim').fill('');
      await expect(p.locator('#klThOwner')).toHaveValue(`tk:${ID.cv1}`);   // xoá chữ tìm: giữ lựa chọn
      await expect(p.locator('#klThOwner')).not.toHaveAttribute('size', /./);
      await p.locator('#gvNhanhOwner button', { hasText: 'Chính tôi' }).click();
      await expect(p.locator('#klThOwner')).toHaveValue(`tk:${ID.tp}`);
      await p.locator('#gvThemDong').click();
      await o(p, 2, 'owner_tim').fill('chuyen vien mot');
      await expect(o(p, 2, 'owner')).toHaveValue(`tk:${ID.cv1}`); await expect(o(p, 2, 'cap_nhan')).toHaveValue('TRUONG_PHONG');
      await expect(the(p, 2).locator('[data-wrap="owner"] .gv-tim-kq')).toContainText('người khớp');
    });
  });

  test('3. Phó Chánh VP tự giao từ Kết luận BTV mới (một việc): "Chính tôi" không bị lọc phạm vi, ngành / lĩnh vực chọn được, DB: Owner = chính mình, cấp nhận Thường trực', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'PCVP', testInfo, async (p) => {
      await moGiaoViec(p);
      await p.locator('#klThVanBan').selectOption('__moi__'); await p.locator('#klThLoaiVB').selectOption('KL_BTV');
      await p.locator('#klThSoHN').fill('996'); await p.locator('#klThSoKL').fill(`${khoa}-KL`); await p.locator('#klThNgayBH').fill(cong(homNay(), -1));
      await p.locator('#klThNoiDung').fill(`${khoa} PCVP tự giao`);
      await p.locator('#gvNhanhOwner button', { hasText: 'Chính tôi' }).click();
      await expect(p.locator('#klThOwner')).toHaveValue(`tk:${ID.pcvp}`);
      await expect(p.locator('#klThCapNhan')).toHaveValue('THUONG_TRUC');
      await p.locator('#klThSanPham').selectOption('TO_TRINH'); await p.locator('#klThHan').fill(H);
      await p.locator('#klThNganh').selectOption('KINH_TE_TONG_HOP'); await p.locator('#klThLinhVuc').selectOption('LV08_TAI_CHINH');
      await expect(p.locator('#gvConThieu')).toHaveText('', NAP);
      await p.locator('#klThLuu').click();
      await expect(p.locator('#toastContainer')).toContainText('Đã giao việc NV-', NAP);
    });
    const v = (await db.from('nhiem_vu').select('owner_tai_khoan, owner_don_vi_ma, nguoi_theo_doi, cap_nhan_san_pham, nganh_ma').like('noi_dung', `${khoa} PCVP tự giao`).single()).data;
    expect(v).toEqual({ owner_tai_khoan: ID.pcvp, owner_don_vi_ma: 'VAN_PHONG_TINH_UY', nguoi_theo_doi: ID.pcvp, cap_nhan_san_pham: 'THUONG_TRUC', nganh_ma: 'KINH_TE_TONG_HOP' });
  });

  test('4. Phó Chánh VP giao hai thẻ khác lĩnh vực trong MỘT lượt từ Kết luận BTV vừa tạo: ngành / lĩnh vực, người theo dõi riêng từng thẻ; DB đúng từng việc', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'PCVP', testInfo, async (p) => {
      await moGiaoViec(p);
      await p.locator('#klThVanBanTim').fill(`${khoa}-KL`);
      await expect(p.locator('#klThVanBan option:checked')).toContainText(`${khoa}-KL`, NAP);   // ô tìm tự chọn văn bản của test 3
      await p.locator('#gvThemDong').click();
      await expect(p.locator('#gvLuoiThan .gv-nv')).toHaveCount(1);
      await p.locator('#klThNoiDung').fill(`${khoa} PCVP thẻ 1`); await p.locator('#klThOwner').selectOption('dv:TONG_HOP');
      await p.locator('#klThNguoiTheoDoi').selectOption(ID.tp);   // người theo dõi riêng của thẻ 1 (trưởng phòng Tổng hợp)
      await p.locator('#klThNganh').selectOption('KINH_TE_TONG_HOP'); await p.locator('#klThLinhVuc').selectOption('LV08_NGAN_SACH');   // không dùng LV08_TAI_CHINH: fixture kiêm nhiệm của spec khác
      await p.locator('#klThSanPham').selectOption('TO_TRINH'); await p.locator('#klThHan').fill(cong(H, 4));
      await o(p, 2, 'noi_dung').fill(`${khoa} PCVP thẻ 2`); await o(p, 2, 'owner').selectOption(`tk:${ID.pcvp}`);
      await o(p, 2, 'nganh').selectOption('THAM_MUU_TONG_HOP'); await o(p, 2, 'linh_vuc').selectOption('LV01_THAM_MUU_TONG_HOP');
      await o(p, 2, 'san_pham').selectOption('BAO_CAO'); await o(p, 2, 'han').fill(cong(H, 5));
      await expect(p.locator('#gvConThieu')).toHaveText('', NAP);
      await p.locator('#klThLuu').click();
      await expect(p.locator('#toastContainer')).toContainText('Đã giao 2 việc', NAP);
    });
    const { data } = await db.from('nhiem_vu').select('noi_dung, owner_don_vi_ma, owner_tai_khoan, nguoi_theo_doi, nganh_ma, linh_vuc_ma, cap_nhan_san_pham').like('noi_dung', `${khoa} PCVP thẻ%`).order('noi_dung');
    expect(data.map((x) => [x.owner_don_vi_ma, x.owner_tai_khoan, x.nguoi_theo_doi, x.nganh_ma, x.linh_vuc_ma, x.cap_nhan_san_pham])).toEqual([
      ['TONG_HOP', null, ID.tp, 'KINH_TE_TONG_HOP', 'LV08_NGAN_SACH', 'PHO_CHANH_VAN_PHONG'],
      ['VAN_PHONG_TINH_UY', ID.pcvp, ID.pcvp, 'THAM_MUU_TONG_HOP', 'LV01_THAM_MUU_TONG_HOP', 'THUONG_TRUC']]);
  });
});
