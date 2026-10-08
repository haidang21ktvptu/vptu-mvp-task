// Ma trận biểu mẫu Giao việc 7 vai × 5 loại văn bản (trước 3.17 là han-nop-minh-chung.spec.js; 0077 bỏ hạn nộp minh chứng — ô không còn, nút Giao
// sáng khi đủ văn bản, nguồn, nội dung, người chịu trách nhiệm, sản phẩm, hạn hoàn thành). Vai: A0 (kể cả giao từ Kết luận có sẵn), Chánh VP, PCVP
// phụ trách cả phòng, PCVP kiêm nhiệm (phân công tạm), Trưởng phòng, A3 giao thay mặt (cờ quan_tri_kl tạm, thay mặt Trưởng phòng), quan_tri_kl
// (demo_qtht, cờ tạm, thay mặt Chánh VP). Mỗi ô: không có ô hạn nộp, "Còn thiếu" không nhắc hạn nộp.
// PR-3 (B, quyết định 1/10/2026 — gộp vào ma trận này, cùng phiên): ô "Nguồn nhiệm vụ" mỗi vai × 5 loại — mặc định theo loại khi tạo văn bản mới, theo loại
// của văn bản CÓ SẴN khi chọn Kết luận (bài học v3.8.0), bỏ chọn ⇒ "Còn thiếu: nguồn nhiệm vụ". Giao thật mỗi vai: pr3-giao-that.spec.js.
// Giao thật: Trưởng phòng (văn bản mới) và A0 từ Kết luận — DB lưu han_nop_minh_chung NULL. A3 thường không có màn Giao việc; việc có hạn nộp cũ
// trong dữ liệu không còn nhãn cam "Chậm nộp minh chứng". Dữ liệu theo khoá; cờ khôi phục.
// Một phiên mở mỗi lúc (docs/KIEM-THU.md — CI #97: 7 phiên song song + realtime làm staging nghẽn): các vai chạy TUẦN TỰ, mở–kiểm–đóng.
import { test, expect } from '@playwright/test';
import { NAP, moGiaoViec } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan, donNhiemVuTheoNoiDung } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, taoViec, datCo, voiPhien } from './lib/pr2b.mjs';

const LOAI = ['KL_BTV', 'TB_THUONG_TRUC', 'NQ_TW', 'CONG_VAN', 'KHAC'];
const VAI = [
  { role: 'A0', ten: 'A0' }, { role: 'A1', ten: 'Chánh VP' }, { role: 'PCVP', ten: 'PCVP phụ trách' }, { role: 'PCVP2', ten: 'PCVP kiêm nhiệm' },
  { role: 'A2', ten: 'Trưởng phòng' }, { role: 'E2E_NV', ten: 'A3 giao thay mặt', thayMat: ID.tp }, { role: 'QTHT', ten: 'quan_tri_kl', thayMat: ID.cvp },
];
const H = cong(homNay(), 20);
const NGUON = { KL_BTV: 'VAN_BAN_CAN_THEO_DOI', TB_THUONG_TRUC: 'VAN_BAN_CAN_THEO_DOI', NQ_TW: 'VAN_BAN_CAN_THEO_DOI', CONG_VAN: 'NHIEM_VU_PHAT_SINH', KHAC: 'NHIEM_VU_PHAT_SINH' };
let db; let khoa; let vbKL;
const conThieu = (p) => p.locator('#gvConThieu');
// Gõ khoá vào ô tìm văn bản → biểu mẫu tự chọn kết quả đầu (van-ban.js, tìm ở DB sau 300 ms; lỗi mạng / statement timeout trên staging bận thì
// giữ im lặng) ⇒ gõ lại một lần nếu sau 20 giây vẫn chưa chọn.
async function chonVanBan(page, tuKhoa, id) {
  for (let lan = 0; lan < 2; lan += 1) {
    await page.locator('#klThVanBanTim').fill(''); await page.locator('#klThVanBanTim').fill(tuKhoa);
    try { await expect(page.locator('#klThVanBan')).toHaveValue(id, NAP); return; } catch (e) { if (lan) throw e; }
  }
}
const khoiPhuc = () => Promise.all([datCo(db, ID.e2eNv, { quan_tri_kl: false }), datCo(db, '00000000-0000-4000-8000-000000000008', { quan_tri_kl: false }),
  db.from('phu_trach_phong').delete().like('ly_do', `${khoa}%`)]);

async function kiemMotLoai(page, v, loai) {
  await page.locator('#klThVanBan').selectOption('__moi__');
  await page.locator('#klThLoaiVB').selectOption(loai);
  await expect(page.locator('#klThHanNopWrap'), `${v.ten} ${loai}: không còn ô hạn nộp`).toHaveCount(0);
  if (v.role === 'A0') {   // A0 để trống số hiệu = giao trực tiếp (DB tạo văn bản KHAC) ⇒ nguồn theo KHAC; gõ số hiệu ⇒ theo loại đã chọn
    await page.locator('#klThSoKL').fill('');
    await expect(page.locator('#klThNguon'), `A0 ${loai}: giao trực tiếp`).toHaveValue(NGUON.KHAC);
    await page.locator('#klThSoKL').fill(`${khoa}-A0`);
  }
  await expect(page.locator('#klThNguon'), `${v.ten} ${loai}: nguồn mặc định`).toHaveValue(NGUON[loai]);
  await expect(conThieu(page), `${v.ten} ${loai}`).not.toContainText('hạn nộp');
  await expect(conThieu(page), `${v.ten} ${loai}`).toContainText('nội dung');
}
async function kiemVai(page, v) {
  await moGiaoViec(page);
  if (v.thayMat) { await page.locator('#klThThayMat').selectOption(v.thayMat); await expect(page.locator('#gvKhoa')).toBeEnabled(NAP); }
  await page.locator('#klThHan').fill(H);
  await expect(page.locator('#klThHanGhiChu'), v.ten).toContainText(/Còn \d+ ngày/, NAP);
  for (const loai of LOAI) await kiemMotLoai(page, v, loai);
  // PR-3: văn bản CÓ SẴN (Kết luận BTV của spec) ⇒ nguồn theo loại của văn bản đó; bỏ chọn ⇒ "Còn thiếu".
  await chonVanBan(page, `${khoa}-KL`, vbKL);
  await expect(page.locator('#klThNguon'), `${v.ten} văn bản có sẵn`).toHaveValue('VAN_BAN_CAN_THEO_DOI');
  await page.locator('#klThNguon').selectOption('');
  await expect(conThieu(page), v.ten).toContainText('nguồn nhiệm vụ');
}

test.describe.serial('Giao việc — ma trận 7 vai × 5 loại văn bản (không còn hạn nộp minh chứng)', () => {
  test.describe.configure({ timeout: 180_000 });   // hành trình nhiều bước (staging chậm)
  let K;
  test.beforeAll(async () => {
    db = dbAdmin(); khoa = khoaRieng('HN', test.info());
    await khoiPhuc();
    await datCo(db, ID.e2eNv, { quan_tri_kl: true }); await datCo(db, '00000000-0000-4000-8000-000000000008', { quan_tri_kl: true });
    const r = await db.from('phu_trach_phong').insert({ lanh_dao_id: ID.pcvp2, phong: 'TONG_HOP', nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_TAI_CHINH',
      tu_ngay: '2026-01-01', den_ngay: null, ly_do: `${khoa} kiêm nhiệm`, phan_cong_boi: '00000000-0000-4000-8000-000000000008' });
    if (r.error) throw new Error(`Phân công kiêm nhiệm tạm: ${r.error.message}`);
    vbKL = await taoVanBanRieng(db, `${khoa}-KL`, { loai: 'KL_BTV', so_hoi_nghi: 997, ngay_ban_hanh: cong(homNay(), -2), ngay_nhan: cong(homNay(), -1) });
    // Văn bản chỉ hiện với người thấy ít nhất một việc của nó (kl_van_ban_thay_duoc): việc S ở phòng Tổng hợp để A2 / PCVP / PCVP2 kiêm nhiệm tìm được.
    await taoViec(db, vbKL, `${khoa} S văn bản`, { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: ID.cv1, nguoi_theo_doi: ID.cv1, tao_boi: ID.tp });
    // Chủ trì demo_e2e_cv (mặc định taoViec) — không dùng demo_e2e_kl: bo-cuc đã đăng xuất (huỷ phiên chung) trước project này.
    // Dữ liệu cũ có hạn nộp đã qua: trigger 0077 đưa về NULL ⇒ việc chỉ là Đang thực hiện, không còn nhãn cam.
    K = await taoViec(db, vbKL, `${khoa} K hạn nộp cũ`, { han_nop_minh_chung: cong(homNay(), -1), han_xu_ly: cong(homNay(), 15) });
    await db.from('lich_su').insert({ nhiem_vu_id: K.id, nguoi_sua: ID.e2eCv, cot: 'xac_nhan_nhan_viec', gia_tri_moi: 'Đã nhận việc (e2e)', nguon: 'app' });
  });
  test.afterAll(async () => {
    if (db) { await donNhiemVuTheoNoiDung(db, khoa); await donVanBan(db, khoa); await donVanBan(db, `${khoa}-GV`); await donVanBan(db, `${khoa}-KL`); await khoiPhuc(); }
  });

  test('1. Ma trận 7 vai × 5 loại văn bản (tuần tự từng vai): không có ô hạn nộp, nguồn mặc định đúng, "Còn thiếu" không nhắc hạn nộp', async ({ browser }, testInfo) => {
    test.setTimeout(420_000);   // 7 vai nối tiếp, mỗi vai một phiên
    for (const v of VAI) await voiPhien(browser, v.role, testInfo, (p) => kiemVai(p, v));
  });

  test('2. Giao thật: Trưởng phòng (văn bản mới) và A0 từ Kết luận có sẵn — nút Giao sáng khi đủ hạn hoàn thành, DB lưu han_nop_minh_chung NULL', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'A2', testInfo, async (p) => {
      await moGiaoViec(p);
      await p.locator('#klThVanBan').selectOption('__moi__'); await p.locator('#klThLoaiVB').selectOption('CONG_VAN');
      await p.locator('#klThSoKL').fill(`${khoa}-GV`); await p.locator('#klThNgayBH').fill(cong(homNay(), -1));
      await p.locator('#klThNoiDung').fill(`${khoa} giao thật A2`); await p.locator('#klThOwner').selectOption(`tk:${ID.cv1}`);
      await p.locator('#klThSanPham').selectOption('BAO_CAO');
      await expect(conThieu(p)).toHaveText('Còn thiếu: hạn hoàn thành', NAP); await expect(p.locator('#klThLuu')).toBeDisabled();
      await p.locator('#klThHan').fill(H);
      await expect(conThieu(p)).toHaveText('', NAP);
      await expect(p.locator('#klThLuu')).toBeEnabled(); await p.locator('#klThLuu').click();
      await expect(p.locator('#toastContainer')).toContainText('Đã giao việc NV-');
    });
    await voiPhien(browser, 'A0', testInfo, async (a0) => {
      await moGiaoViec(a0);
      await chonVanBan(a0, `${khoa}-KL`, vbKL);
      await a0.locator('#klThNoiDung').fill(`${khoa} giao thật A0 từ Kết luận`); await a0.locator('#klThOwner').selectOption(`tk:${ID.cvp}`);
      await a0.locator('#klThSanPham').selectOption('BAO_CAO'); await a0.locator('#klThHan').fill(H);
      await a0.locator('#klThNganh').selectOption('KINH_TE_TONG_HOP'); await a0.locator('#klThLinhVuc').selectOption('LV08_TAI_CHINH');
      await expect(a0.locator('#klThHanNopWrap')).toHaveCount(0);
      await expect(a0.locator('#klThLuu')).toBeEnabled(NAP); await a0.locator('#klThLuu').click();
      await expect(a0.locator('#toastContainer')).toContainText('Đã giao việc NV-');
    });
    const { data } = await db.from('nhiem_vu').select('noi_dung, han_nop_minh_chung').like('noi_dung', `${khoa} giao thật%`);
    expect(data.map((x) => x.han_nop_minh_chung)).toEqual([null, null]);
  });

  test('3. A3 thường có màn Giao việc (v3.18 Đợt E, giao thẳng cho chuyên viên); việc có hạn nộp cũ không còn nhãn cam "Chậm nộp minh chứng"', async ({ browser }, testInfo) => {
    expect((await db.from('nhiem_vu').select('han_nop_minh_chung').eq('id', K.id).single()).data.han_nop_minh_chung).toBeNull();
    await voiPhien(browser, 'E2E_CV', testInfo, async (a3) => {
      await expect(a3.locator('#navGiaoViec')).toHaveCount(1);
      const the = a3.locator(`#vct-${K.id}`);
      await expect(the).toBeVisible(NAP);
      await expect(the.locator('.tt-cam')).toHaveCount(0);
      await expect(the).not.toHaveClass(/\bcam\b/);
    });
  });
});
