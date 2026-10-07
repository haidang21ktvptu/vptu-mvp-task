// PR-2b (thiết kế E2 "hanh-trinh-5-loai-van-ban"): hành trình đủ của MỖI loại văn bản KL_BTV, TB_THUONG_TRUC, NQ_TW, CONG_VAN, KHAC — Trưởng phòng
// (demo_e2e_tp, phòng E2E_RT) giao qua BIỂU MẪU THẬT ("Giao, nhập tiếp", văn bản mới mỗi loại; 0077: không còn hạn nộp) → chủ trì A3 (demo_e2e_cv)
// xác nhận nhận việc trên "Việc của tôi" → nộp minh chứng 4 yếu tố ở ngăn chi tiết → Trưởng phòng nghiệm thu ở "Cần nghiệm thu" (đóng luôn — Q2)
// → Hoàn thành; nhãn "Hoàn thành", Điều hành không còn việc mở của đợt, cây Theo văn bản (Chánh VP) có đủ 5 văn bản với việc đã hoàn thành.
// Văn bản so_ket_luan = <khoá>-<loại>; tự dọn trước và sau.
import { test, expect } from '@playwright/test';
import { NAP, moGiaoViec, moViec, nav } from './lib/app.js';
import { khoaRieng, donVanBan } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, moApp, moNghiemThu, nghiemThuMc } from './lib/pr2b.mjs';

const LOAI = ['KL_BTV', 'TB_THUONG_TRUC', 'NQ_TW', 'CONG_VAN', 'KHAC'];
const CAN_NGANH = new Set(['KL_BTV', 'TB_THUONG_TRUC']);

test.describe.serial('PR-2b — hành trình 5 loại văn bản: giao → nhận → nộp → nghiệm thu → hoàn thành', () => {
  test.describe.configure({ timeout: 180_000 });   // hành trình nhiều bước, nhiều phiên (staging chậm)
  let db; let khoa; let tp; let cv; const viec = {};
  const don = async () => { for (const l of LOAI) await donVanBan(db, `${khoa}-${l}`); };

  test.beforeAll(async ({ browser }, testInfo) => {
    db = dbAdmin(); khoa = khoaRieng('HT5', testInfo); await don();
    [tp, cv] = await Promise.all([moApp(browser, 'E2E_TP', testInfo), moApp(browser, 'E2E_CV', testInfo)]);
  });
  test.afterAll(async () => { await tp?.context().close(); await cv?.context().close(); if (db) await don(); });

  test('1. Trưởng phòng giao 5 việc qua biểu mẫu thật (mỗi loại một văn bản mới, không cần hạn nộp minh chứng — 0077)', async () => {
    await moGiaoViec(tp);
    for (const loai of LOAI) {
      await tp.locator('#klThVanBan').selectOption('__moi__'); await tp.locator('#klThLoaiVB').selectOption(loai);
      await tp.locator('#klThSoKL').fill(`${khoa}-${loai}`); await tp.locator('#klThNgayBH').fill(cong(homNay(), -1));
      if (loai === 'KL_BTV') await tp.locator('#klThSoHN').fill('9');
      await tp.locator('#klThNoiDung').fill(`${khoa} ${loai} hành trình`); await tp.locator('#klThOwner').selectOption(`tk:${ID.e2eCv}`);
      await tp.locator('#klThSanPham').selectOption('BAO_CAO'); await tp.locator('#klThHan').fill(cong(homNay(), 20));
      if (CAN_NGANH.has(loai)) { await tp.locator('#klThNganh').selectOption('KINH_TE_TONG_HOP'); await tp.locator('#klThLinhVuc').selectOption('LV08_TAI_CHINH'); }
      await expect(tp.locator('#gvConThieu'), loai).toHaveText('');
      await tp.locator('#klThLuuTiep').click();
      await expect(tp.locator('#toastContainer'), loai).toContainText('Đã giao việc NV-', NAP);
      await expect(tp.locator('#klThNoiDung')).toHaveValue('');
    }
    const { data } = await db.from('nhiem_vu').select('id, ma, han_nop_minh_chung, van_ban_giao_viec!inner(loai, so_ket_luan)').like('van_ban_giao_viec.so_ket_luan', `${khoa}-%`);
    expect(data.map((x) => x.van_ban_giao_viec.loai).sort()).toEqual([...LOAI].sort());
    data.forEach((x) => { expect(x.han_nop_minh_chung).toBeNull(); viec[x.van_ban_giao_viec.loai] = x; });
  });

  test('2. Chủ trì A3 xác nhận nhận việc trên "Việc của tôi" rồi nộp minh chứng 4 yếu tố ở ngăn chi tiết', async () => {
    await cv.reload(); await expect(cv.locator('#mainHeader')).toBeVisible(NAP);
    for (const loai of LOAI) {
      const nut = cv.locator(`#vct-${viec[loai].id} [data-action="xacNhanNhanThe"]`);
      await expect(nut, loai).toBeVisible(NAP); await nut.click();
      await expect(nut, loai).toHaveCount(0, NAP);   // đã nhận ⇒ việc rời mục "Việc mới"
    }
    for (const loai of LOAI) {
      const v = viec[loai];
      await moViec(cv, v.id, v.ma);
      await cv.locator(`#klChiTiet-${v.id}`).getByRole('button', { name: 'Nộp minh chứng' }).click();
      await cv.locator('#klMcSoHieu').fill(`${khoa}-${loai}/KQ`); await cv.locator('#klMcNgay').fill(homNay());
      await cv.locator('#klMcTrichYeu').fill(`Báo cáo kết quả ${loai}`); await cv.locator('#klMcMoTaKq').fill('Đã thực hiện, gửi Trưởng phòng.');
      await cv.locator('#klMcLuu').click(); await expect(cv.locator('#klMcModal')).toBeHidden();
      await expect(cv.locator(`#klChiTiet-${v.id} .ct-nhan .trang-thai`), loai).toHaveText('Đã nộp — chờ nghiệm thu', NAP);
    }
  });

  test('3. Trưởng phòng nghiệm thu cả 5 → Hoàn thành (ngày = ngày văn bản); Điều hành và cây Theo văn bản khớp', async ({ browser }, testInfo) => {
    await moNghiemThu(tp);
    for (const loai of LOAI) {
      const mc = (await db.from('minh_chung').select('id').eq('nhiem_vu_id', viec[loai].id).single()).data.id;
      await nghiemThuMc(tp, mc, 'DAT_TOT');
      await expect(tp.locator('#toastContainer'), loai).toContainText(`${viec[loai].ma} hoàn thành`, NAP);
    }
    const { data } = await db.from('v_nhiem_vu').select('trang_thai, ngay_hoan_thanh, nghiem_thu_dung_han, nop_dung_han').in('id', LOAI.map((l) => viec[l].id));
    expect(data).toEqual(LOAI.map(() => ({ trang_thai: 'HOAN_THANH', ngay_hoan_thanh: homNay(), nghiem_thu_dung_han: 'DUNG_HAN', nop_dung_han: 'DUNG_HAN' })));
    await tp.context().close(); tp = null;   // tối đa 2 phiên cùng lúc (docs/KIEM-THU.md)
    await moViec(cv, viec.CONG_VAN.id, viec.CONG_VAN.ma);
    await expect(cv.locator(`#klChiTiet-${viec.CONG_VAN.id} .ct-nhan .trang-thai`)).toHaveText('Hoàn thành đúng hạn', NAP);
    await cv.context().close(); cv = null;
    const cvp = await moApp(browser, 'A1', testInfo);
    try {
      await nav(cvp, 'navTheoVanBan');
      for (const loai of LOAI) await expect(cvp.locator('#viewTheoVanBan'), loai).toContainText(`${khoa}-${loai}`, NAP);
    } finally { await cvp.context().close(); }
  });
});
