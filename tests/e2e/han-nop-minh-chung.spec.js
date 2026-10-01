// PR-2b (thiết kế A12, E2 "han-nop-minh-chung"; bổ sung G 30/9): ô "Hạn nộp minh chứng" trên biểu mẫu Giao việc — ma trận 7 vai × 5 loại văn bản:
// A0 (kể cả giao từ Kết luận có sẵn), Chánh VP, PCVP phụ trách cả phòng, PCVP kiêm nhiệm (phân công tạm), Trưởng phòng, A3 giao thay mặt (cờ
// quan_tri_kl tạm, thay mặt Trưởng phòng), quan_tri_kl (demo_qtht, cờ tạm, thay mặt Chánh VP). Mỗi ô: ô hiện, bắt buộc (dòng "Còn thiếu"), gợi ý
// "muộn nhất …" = kl_khung_han_nop của DB, chọn sát (= hạn hoàn thành) ⇒ hiện ô lý do việc gấp. Giao thật: Trưởng phòng và A0 từ Kết luận (nút Giao
// mờ khi thiếu hạn nộp, sáng khi đủ; DB lưu đúng ngày). A3 thường không có màn Giao việc. Ngăn chi tiết: chỉ người giao thấy "Sửa hạn nộp minh chứng"
// (sửa được, lịch sử + DB). Nhãn cam "Chậm nộp minh chứng" khi qua hạn nộp. Dữ liệu theo khoá; cờ khôi phục.
// PR-3 (B, quyết định 1/10/2026 — gộp vào ma trận này, cùng phiên): ô "Nguồn nhiệm vụ" mỗi vai × 5 loại — mặc định theo loại khi tạo văn bản mới, theo loại
// của văn bản CÓ SẴN khi chọn Kết luận (bài học v3.8.0), bỏ chọn ⇒ "Còn thiếu: nguồn nhiệm vụ". Giao thật mỗi vai: pr3-giao-that.spec.js.
// Một phiên mở mỗi lúc (docs/KIEM-THU.md — CI #97: 7 phiên song song + realtime làm staging nghẽn): các vai chạy TUẦN TỰ, mở–kiểm–đóng.
import { test, expect } from '@playwright/test';
import { NAP, moGiaoViec, moViec, dienHanNop } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan, donNhiemVuTheoNoiDung } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, dd, taoViec, datCo, voiPhien } from './lib/pr2b.mjs';

const LOAI = ['KL_BTV', 'TB_THUONG_TRUC', 'NQ_TW', 'CONG_VAN', 'KHAC'];
const VAI = [
  { role: 'A0', ten: 'A0' }, { role: 'A1', ten: 'Chánh VP' }, { role: 'PCVP', ten: 'PCVP phụ trách' }, { role: 'PCVP2', ten: 'PCVP kiêm nhiệm' },
  { role: 'A2', ten: 'Trưởng phòng' }, { role: 'E2E_NV', ten: 'A3 giao thay mặt', thayMat: ID.tp }, { role: 'QTHT', ten: 'quan_tri_kl', thayMat: ID.cvp },
];
const H = cong(homNay(), 20);
const NGUON = { KL_BTV: 'VAN_BAN_CAN_THEO_DOI', TB_THUONG_TRUC: 'VAN_BAN_CAN_THEO_DOI', NQ_TW: 'VAN_BAN_CAN_THEO_DOI', CONG_VAN: 'NHIEM_VU_PHAT_SINH', KHAC: 'NHIEM_VU_PHAT_SINH' };
let db; let khoa; let khung; let vbKL;
const conThieu = (p) => p.locator('#gvConThieu');
const khoiPhuc = () => Promise.all([datCo(db, ID.e2eNv, { quan_tri_kl: false }), datCo(db, '00000000-0000-4000-8000-000000000008', { quan_tri_kl: false }),
  db.from('phu_trach_phong').delete().like('ly_do', `${khoa}%`)]);

async function kiemMotLoai(page, v, loai) {
  await page.locator('#klThVanBan').selectOption('__moi__');
  await page.locator('#klThLoaiVB').selectOption(loai);
  await expect(page.locator('#klThHanNopWrap'), `${v.ten} ${loai}`).toBeVisible();
  if (v.role === 'A0') {   // A0 để trống số hiệu = giao trực tiếp (DB tạo văn bản KHAC) ⇒ nguồn theo KHAC; gõ số hiệu ⇒ theo loại đã chọn
    await page.locator('#klThSoKL').fill('');
    await expect(page.locator('#klThNguon'), `A0 ${loai}: giao trực tiếp`).toHaveValue(NGUON.KHAC);
    await page.locator('#klThSoKL').fill(`${khoa}-A0`);
  }
  await expect(page.locator('#klThNguon'), `${v.ten} ${loai}: nguồn mặc định`).toHaveValue(NGUON[loai]);
  await expect(conThieu(page), `${v.ten} ${loai}`).toContainText('hạn nộp minh chứng');
  await page.locator('#klThHanNop').fill(H);   // sát hạn hoàn thành ⇒ phải ghi lý do việc gấp
  await expect(page.locator('#klThLyDoSatWrap'), `${v.ten} ${loai}`).toBeVisible();
  await expect(conThieu(page)).toContainText('lý do việc gấp');
  await page.locator('#klThHanNop').fill('');
}
async function kiemVai(page, v) {
  await moGiaoViec(page);
  if (v.thayMat) { await page.locator('#klThThayMat').selectOption(v.thayMat); await expect(page.locator('#gvKhoa')).toBeEnabled(NAP); }
  await page.locator('#klThHan').fill(H);
  await expect(page.locator('#klThHanNopGoiY'), v.ten).toContainText(`muộn nhất ${dd(khung.khong_ly_do_den)}`, NAP);
  for (const loai of LOAI) await kiemMotLoai(page, v, loai);
  // PR-3: văn bản CÓ SẴN (Kết luận BTV của spec) ⇒ nguồn theo loại của văn bản đó; bỏ chọn ⇒ "Còn thiếu".
  await page.locator('#klThVanBanTim').fill(`${khoa}-KL`);
  await expect(page.locator('#klThVanBan')).toHaveValue(vbKL, NAP);
  await expect(page.locator('#klThNguon'), `${v.ten} văn bản có sẵn`).toHaveValue('VAN_BAN_CAN_THEO_DOI');
  await page.locator('#klThNguon').selectOption('');
  await expect(conThieu(page), v.ten).toContainText('nguồn nhiệm vụ');
}

test.describe.serial('PR-2b — hạn nộp minh chứng trên biểu mẫu và ngăn chi tiết', () => {
  test.describe.configure({ timeout: 180_000 });   // hành trình nhiều bước (staging chậm)
  let S; let K;
  test.beforeAll(async () => {
    db = dbAdmin(); khoa = khoaRieng('HN', test.info());
    await khoiPhuc();
    await datCo(db, ID.e2eNv, { quan_tri_kl: true }); await datCo(db, '00000000-0000-4000-8000-000000000008', { quan_tri_kl: true });
    const r = await db.from('phu_trach_phong').insert({ lanh_dao_id: ID.pcvp2, phong: 'TONG_HOP', nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_TAI_CHINH',
      tu_ngay: '2026-01-01', den_ngay: null, ly_do: `${khoa} kiêm nhiệm`, phan_cong_boi: '00000000-0000-4000-8000-000000000008' });
    if (r.error) throw new Error(`Phân công kiêm nhiệm tạm: ${r.error.message}`);
    khung = (await db.rpc('kl_khung_han_nop', { p_han_xu_ly: H })).data;
    const vb = vbKL = await taoVanBanRieng(db, `${khoa}-KL`, { loai: 'KL_BTV', so_hoi_nghi: 997, ngay_ban_hanh: cong(homNay(), -2), ngay_nhan: cong(homNay(), -1) });
    S = await taoViec(db, vb, `${khoa} S sửa hạn`, { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: ID.cv1, nguoi_theo_doi: ID.cv1, tao_boi: ID.tp });
    // Chủ trì demo_e2e_cv (mặc định taoViec) — không dùng demo_e2e_kl: bo-cuc đã đăng xuất (huỷ phiên chung) trước project này.
    K = await taoViec(db, vb, `${khoa} K chậm nộp`, { han_nop_minh_chung: cong(homNay(), -1), han_xu_ly: cong(homNay(), 15) });
    await db.from('lich_su').insert({ nhiem_vu_id: K.id, nguoi_sua: ID.e2eCv, cot: 'xac_nhan_nhan_viec', gia_tri_moi: 'Đã nhận việc (e2e)', nguon: 'app' });
  });
  test.afterAll(async () => {
    if (db) { await donNhiemVuTheoNoiDung(db, khoa); await donVanBan(db, khoa); await donVanBan(db, `${khoa}-GV`); await donVanBan(db, `${khoa}-KL`); await khoiPhuc(); }
  });

  test('1. Ma trận 7 vai × 5 loại văn bản (tuần tự từng vai): ô hiện, bắt buộc, gợi ý từ DB, sát hạn thì bắt lý do', async ({ browser }, testInfo) => {
    test.setTimeout(420_000);   // 7 vai nối tiếp, mỗi vai một phiên
    for (const v of VAI) await voiPhien(browser, v.role, testInfo, (p) => kiemVai(p, v));
  });

  test('2. Giao thật: Trưởng phòng (văn bản mới) và A0 từ Kết luận có sẵn — nút Giao mờ khi thiếu hạn nộp, DB lưu đúng ngày gợi ý', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'A2', testInfo, async (p) => {
      await moGiaoViec(p);
      await p.locator('#klThVanBan').selectOption('__moi__'); await p.locator('#klThLoaiVB').selectOption('CONG_VAN');
      await p.locator('#klThSoKL').fill(`${khoa}-GV`); await p.locator('#klThNgayBH').fill(cong(homNay(), -1));
      await p.locator('#klThNoiDung').fill(`${khoa} giao thật A2`); await p.locator('#klThOwner').selectOption(`tk:${ID.cv1}`);
      await p.locator('#klThSanPham').selectOption('BAO_CAO'); await p.locator('#klThHan').fill(H);
      await expect(conThieu(p)).toHaveText('Còn thiếu: hạn nộp minh chứng', NAP); await expect(p.locator('#klThLuu')).toBeDisabled();
      await dienHanNop(p);
      await expect(p.locator('#klThLuu')).toBeEnabled(); await p.locator('#klThLuu').click();
      await expect(p.locator('#toastContainer')).toContainText('Đã giao việc NV-');
    });
    await voiPhien(browser, 'A0', testInfo, async (a0) => {
      await moGiaoViec(a0);
      await a0.locator('#klThVanBanTim').fill(`${khoa}-KL`);
      await expect(a0.locator('#klThVanBan')).not.toHaveValue('__moi__', NAP);
      await a0.locator('#klThNoiDung').fill(`${khoa} giao thật A0 từ Kết luận`); await a0.locator('#klThOwner').selectOption(`tk:${ID.cvp}`);
      await a0.locator('#klThSanPham').selectOption('BAO_CAO'); await a0.locator('#klThHan').fill(H);
      await a0.locator('#klThNganh').selectOption('KINH_TE_TONG_HOP'); await a0.locator('#klThLinhVuc').selectOption('LV08_TAI_CHINH');
      await expect(a0.locator('#klThHanNopWrap')).toBeVisible();
      await dienHanNop(a0); await a0.locator('#klThLuu').click();
      await expect(a0.locator('#toastContainer')).toContainText('Đã giao việc NV-');
    });
    const { data } = await db.from('nhiem_vu').select('noi_dung, han_nop_minh_chung').like('noi_dung', `${khoa} giao thật%`);
    expect(data.map((x) => x.han_nop_minh_chung)).toEqual([khung.khong_ly_do_den, khung.khong_ly_do_den]);
  });

  test('3. Ngăn chi tiết: chỉ người giao thấy "Sửa hạn nộp minh chứng"; sửa có lý do → DB + lịch sử', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'PCVP', testInfo, async (p) => {
      await moViec(p, S.id, S.ma);
      await expect(p.locator(`#klChiTiet-${S.id}`).getByRole('button', { name: 'Sửa hạn nộp minh chứng' })).toHaveCount(0);
    });
    await voiPhien(browser, 'A2', testInfo, async (p) => {
      await moViec(p, S.id, S.ma);
      await p.locator(`#klChiTiet-${S.id}`).getByRole('button', { name: 'Sửa hạn nộp minh chứng' }).click();
      await p.locator(`#oHnNgan-${S.id} [name=han]`).fill(cong(homNay(), 9));
      await p.locator(`#oHnNgan-${S.id} [name=ly_do]`).fill('Điều chỉnh theo lịch họp');
      await p.locator(`#oHnNgan-${S.id}`).getByRole('button', { name: 'Lưu hạn nộp' }).click();
      await expect(p.locator('#toastContainer')).toContainText('Đã sửa hạn nộp minh chứng');
    });
    expect((await db.from('nhiem_vu').select('han_nop_minh_chung').eq('id', S.id).single()).data.han_nop_minh_chung).toBe(cong(homNay(), 9));
  });

  test('4. A3 thường không có màn Giao việc; việc qua hạn nộp hiện nhãn cam "Chậm nộp minh chứng"', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_CV', testInfo, async (a3) => {
      await expect(a3.locator('#navGiaoViec')).toHaveCount(0);
      const the = a3.locator(`#vct-${K.id}`);
      await expect(the).toBeVisible(NAP);
      await expect(the.locator('.tt-cam')).toHaveText('Chậm nộp minh chứng');
      await expect(the).toHaveClass(/\bcam\b/);
    });
  });
});
