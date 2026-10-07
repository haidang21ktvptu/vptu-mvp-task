// PR-3 (B, E, F) — giao THẬT một việc mỗi vai (7 vai, tuần tự, mỗi lúc một phiên — docs/KIEM-THU.md): A0 giao từ Kết luận có sẵn, Chánh VP,
// PCVP phụ trách cả phòng, PCVP kiêm nhiệm (phân công tạm), Trưởng phòng, A3 giao thay mặt (quan_tri_kl tạm, thay mặt Trưởng phòng), quan_tri_kl
// (demo_qtht, thay mặt Chánh VP). Ô Nguồn mặc định theo loại văn bản ở CẢ hai đường — văn bản mới và văn bản có sẵn (bài học v3.8.0); Trưởng phòng
// tự đổi nguồn; Chánh VP điền đơn vị phối hợp + số nhiệm vụ dự kiến + đã rà soát. DB lưu đúng cột. Ma trận 7 vai × 5 loại (ô hiện, mặc định,
// "Còn thiếu" khi bỏ chọn) nằm trong giao-viec-ma-tran.spec.js (cùng phiên — quyết định 1/10/2026; 0077 bỏ hạn nộp). Dữ liệu theo khoá; cờ khôi phục.
import { test, expect } from '@playwright/test';
import { NAP, moGiaoViec } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan, donNhiemVuTheoNoiDung } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, taoViec, datCo, voiPhien } from './lib/pr2b.mjs';

const QTHT = '00000000-0000-4000-8000-000000000008';
const NGUON = { KL_BTV: 'VAN_BAN_CAN_THEO_DOI', TB_THUONG_TRUC: 'VAN_BAN_CAN_THEO_DOI', NQ_TW: 'VAN_BAN_CAN_THEO_DOI', CONG_VAN: 'NHIEM_VU_PHAT_SINH', KHAC: 'NHIEM_VU_PHAT_SINH' };
const KN = { nganh: 'KINH_TE_TONG_HOP', lv: 'LV08_TAI_CHINH', lvKhac: 'LV08_NGAN_SACH' };
// vb: 'KL' = Kết luận có sẵn (KL_BTV) của spec; còn lại = văn bản mới loại đó. nganh: lĩnh vực cần chọn (KL / Thông báo bắt buộc; PCVP2 chỉ lĩnh vực kiêm nhiệm).
const CA = [
  { role: 'A0', vb: 'KL', owner: `tk:${ID.cvp}`, lv: KN.lvKhac },
  { role: 'A1', vb: 'CONG_VAN', owner: `tk:${ID.cv1}`, phoiHop: 'Sở Tài chính; Sở Nội vụ', duKien: 2 },
  { role: 'PCVP', vb: 'NQ_TW', owner: 'dv:TONG_HOP' },
  { role: 'PCVP2', vb: 'KL', owner: 'dv:TONG_HOP', lv: KN.lv },
  { role: 'A2', vb: 'KHAC', owner: `tk:${ID.cv1}`, chon: 'NHIEM_VU_DINH_KY' },
  { role: 'E2E_NV', thayMat: ID.tp, vb: 'TB_THUONG_TRUC', owner: `tk:${ID.cv1}`, lv: KN.lvKhac },
  { role: 'QTHT', thayMat: ID.cvp, vb: 'KL', owner: `tk:${ID.cv1}`, lv: KN.lvKhac },
];
const H = cong(homNay(), 20);
let db; let khoa; let vbKL;
const khoiPhuc = () => Promise.all([datCo(db, ID.e2eNv, { quan_tri_kl: false }), datCo(db, QTHT, { quan_tri_kl: false }),
  db.from('phu_trach_phong').delete().like('ly_do', `${khoa}%`)]);

async function giaoMot(page, ca) {
  await moGiaoViec(page);
  if (ca.thayMat) { await page.locator('#klThThayMat').selectOption(ca.thayMat); await expect(page.locator('#gvKhoa')).toBeEnabled(NAP); }
  const loai = ca.vb === 'KL' ? 'KL_BTV' : ca.vb;
  if (ca.vb === 'KL') {   // đường văn bản CÓ SẴN: loại lấy từ văn bản đã chọn
    await page.locator('#klThVanBanTim').fill(`${khoa}-KL`);
    await expect(page.locator('#klThVanBan')).toHaveValue(vbKL, NAP);
  } else {
    await page.locator('#klThVanBan').selectOption('__moi__'); await page.locator('#klThLoaiVB').selectOption(loai);
    await page.locator('#klThSoKL').fill(`${khoa}-${ca.role}`); await page.locator('#klThNgayBH').fill(cong(homNay(), -1));
    if (ca.duKien !== undefined) { await page.locator('#gvVbDuKien').fill(String(ca.duKien)); await page.locator('#gvVbRaSoat').check(); }
  }
  await expect(page.locator('#klThNguon'), `${ca.role}: mặc định theo ${loai}`).toHaveValue(NGUON[loai]);
  if (ca.chon) await page.locator('#klThNguon').selectOption(ca.chon);
  await page.locator('#klThNoiDung').fill(`${khoa} giao ${ca.role}`); await page.locator('#klThOwner').selectOption(ca.owner);
  if (ca.lv) { await page.locator('#klThNganh').selectOption(KN.nganh); await page.locator('#klThLinhVuc').selectOption(ca.lv); }
  await page.locator('#klThSanPham').selectOption('BAO_CAO'); await page.locator('#klThHan').fill(H);
  if (ca.phoiHop) await page.locator('#klThPhoiHop').fill(ca.phoiHop);
  await expect(page.locator('#gvConThieu'), ca.role).toHaveText('', NAP);
  await page.locator('#klThLuu').click();
  await expect(page.locator('#toastContainer'), ca.role).toContainText('Đã giao việc NV-', NAP);
}

test.describe.serial('PR-3 — giao thật mỗi vai: nguồn nhiệm vụ, đơn vị phối hợp, rà soát văn bản', () => {
  test.beforeAll(async () => {
    db = dbAdmin(); khoa = khoaRieng('PR3G', test.info());
    await donNhiemVuTheoNoiDung(db, khoa); await khoiPhuc();
    await datCo(db, ID.e2eNv, { quan_tri_kl: true }); await datCo(db, QTHT, { quan_tri_kl: true });
    const r = await db.from('phu_trach_phong').insert({ lanh_dao_id: ID.pcvp2, phong: 'TONG_HOP', nganh_ma: KN.nganh, linh_vuc_ma: KN.lv,
      tu_ngay: '2026-01-01', den_ngay: null, ly_do: `${khoa} kiêm nhiệm`, phan_cong_boi: QTHT });
    if (r.error) throw new Error(`Phân công kiêm nhiệm tạm: ${r.error.message}`);
    vbKL = await taoVanBanRieng(db, `${khoa}-KL`, { loai: 'KL_BTV', so_hoi_nghi: 996, ngay_ban_hanh: cong(homNay(), -2), ngay_nhan: cong(homNay(), -1) });
    // Một việc sẵn trong phạm vi kiêm nhiệm để mọi vai (kể cả PCVP kiêm nhiệm) thấy văn bản Kết luận.
    await taoViec(db, vbKL, `${khoa} S`, { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: ID.cv1, nguoi_theo_doi: ID.cv1, tao_boi: ID.tp, linh_vuc_ma: KN.lv });
  });
  test.afterAll(async () => {
    if (!db) return;
    await donNhiemVuTheoNoiDung(db, khoa);
    for (const s of ['KL', ...CA.map((c) => c.role)]) await donVanBan(db, `${khoa}-${s}`);
    await khoiPhuc();
  });

  test('Giao thật 7 vai (tuần tự): nguồn mặc định đúng ở văn bản mới và có sẵn, tự chọn được; DB lưu đúng cột', async ({ browser }, testInfo) => {
    test.setTimeout(420_000);   // 7 vai nối tiếp, mỗi vai một phiên
    for (const ca of CA) await voiPhien(browser, ca.role, testInfo, (p) => giaoMot(p, ca));
    const { data } = await db.from('nhiem_vu').select('noi_dung, nguon_nhiem_vu_ma, don_vi_phoi_hop, van_ban_giao_viec!inner(so_nhiem_vu_du_kien, da_ra_soat_toan_van, ra_soat_boi)')
      .like('noi_dung', `${khoa} giao %`);
    const theoVai = Object.fromEntries(data.map((x) => [x.noi_dung.split(' ').pop(), x]));
    expect(Object.fromEntries(CA.map((c) => [c.role, theoVai[c.role]?.nguon_nhiem_vu_ma])))
      .toEqual(Object.fromEntries(CA.map((c) => [c.role, c.chon || NGUON[c.vb === 'KL' ? 'KL_BTV' : c.vb]])));
    expect(theoVai.A1.don_vi_phoi_hop).toBe('Sở Tài chính; Sở Nội vụ');
    expect(theoVai.A1.van_ban_giao_viec).toEqual({ so_nhiem_vu_du_kien: 2, da_ra_soat_toan_van: true, ra_soat_boi: ID.cvp });
  });
});
