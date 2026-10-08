// PR-2b → Đợt D v3.20 (0090, định hướng 8/10/2026 — lãnh đạo theo dõi, chuyên viên nhập liệu): chủ trì A3 nộp minh chứng (kèm tệp PDF tạo lúc chạy)
// → nhiệm vụ HOÀN THÀNH ngay, không còn mục "Cần nghiệm thu"; người giao (A2) thấy ở "Kết quả nộp trong 7 ngày" (Cần xử lý), trả lại (chỉ lý do) →
// việc mở lại → A3 thấy bị trả lại, nộp lại → hoàn thành → A2 đánh giá chất lượng ở ngăn chi tiết (tuỳ chọn). Minh chứng nộp trước v3.20 còn chờ:
// nhãn "chờ xác nhận", Đỏ tính cho lãnh đạo (người chịu chậm), thư ký Thường trực xác nhận thay mặt ở việc Thường trực giao Chánh VP. Tài khoản:
// demo_e2e_cv (A3 E2E_RT), demo_e2e_tp (A2 E2E_RT), demo_e2e_tk (thư ký tạm). Dữ liệu theo khoá riêng; tự dọn; cờ thư ký khôi phục trước và sau.
import { test, expect } from '@playwright/test';
import { NAP, moViec, nav } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, taoViec, taoMinhChung, datCo, moApp, danhGiaMc, xacNhanMcCu } from './lib/pr2b.mjs';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n');

test.describe.serial('Đợt D — nộp minh chứng là hoàn thành; trả lại / đánh giá tuỳ chọn', () => {
  test.describe.configure({ timeout: 180_000 });   // hành trình nhiều bước, nhiều phiên (staging chậm)
  let db; let khoa; let vb; let T; let Q; let C; let cv; let tp;
  const mcCua = async (nv) => (await db.from('minh_chung').select('id, hop_le, tep_path, tep_ten').eq('nhiem_vu_id', nv).order('nop_luc', { ascending: false })).data;
  const viec = async (nv) => (await db.from('nhiem_vu').select('tien_do_ma, ngay_hoan_thanh, chat_luong').eq('id', nv).single()).data;
  const nopTrongNgan = async (page, nv, so, tep = null) => {
    await page.locator(`#klChiTiet-${nv}`).getByRole('button', { name: 'Nộp minh chứng' }).click();
    if (tep) await page.locator('#klMcTep').setInputFiles({ name: tep, mimeType: 'application/pdf', buffer: PDF });
    await page.locator('#klMcSoHieu').fill(so); await page.locator('#klMcNgay').fill(homNay());
    await page.locator('#klMcTrichYeu').fill(`Báo cáo kết quả ${so}`); await page.locator('#klMcMoTaKq').fill('Đã tổng hợp, gửi Trưởng phòng.');
    await page.locator('#klMcLuu').click();
    await expect(page.locator('#klMcModal')).toBeHidden(NAP);
  };

  test.beforeAll(async ({ browser }, testInfo) => {
    db = dbAdmin(); khoa = khoaRieng('NT', testInfo);
    await datCo(db, ID.e2eTk, { thu_ky_thuong_truc: false });
    vb = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN' });
    T = await taoViec(db, vb, `${khoa} T hành trình`);
    Q = await taoViec(db, vb, `${khoa} Q quá hạn chờ xác nhận`, { han_xu_ly: cong(homNay(), -3) });
    C = await taoViec(db, vb, `${khoa} C việc Chánh VP`, { owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: ID.cvp, nguoi_theo_doi: ID.cvp, tao_boi: ID.a0 });
    await taoMinhChung(db, Q.id, ID.e2eCv, `${khoa}/Q`); await taoMinhChung(db, C.id, ID.cvp, `${khoa}/C`);   // như minh chứng nộp trước v3.20
    [cv, tp] = await Promise.all([moApp(browser, 'E2E_CV', testInfo), moApp(browser, 'E2E_TP', testInfo)]);
  });
  test.afterAll(async () => {
    await cv?.context().close(); await tp?.context().close();
    if (db) {
      for (const nv of [T, Q, C].filter(Boolean)) {
        const { data } = await db.storage.from('minh-chung').list(nv.id);
        if (data?.length) await db.storage.from('minh-chung').remove(data.map((f) => `${nv.id}/${f.name}`));
      }
      await donVanBan(db, khoa); await datCo(db, ID.e2eTk, { thu_ky_thuong_truc: false });
    }
  });

  test('1. A3 nộp minh chứng kèm tệp → hoàn thành ngay (không mục "Cần nghiệm thu"); minh chứng cũ đang chờ (đã quá hạn) hiện nhãn trung tính', async () => {
    await expect(cv.locator('#navNghiemThu')).toHaveCount(0);
    await moViec(cv, T.id, T.ma);
    await nopTrongNgan(cv, T.id, `${khoa}/1`, 'bao-cao-ket-qua.pdf');
    await expect(cv.locator(`#klChiTiet-${T.id} .ct-nhan .trang-thai`)).toHaveText(/^Hoàn thành/, NAP);
    expect(await viec(T.id)).toEqual({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: homNay(), chat_luong: null });
    const [mc] = await mcCua(T.id);
    expect([mc.hop_le, mc.tep_ten, mc.tep_path?.startsWith(`${T.id}/`)]).toEqual([true, 'bao-cao-ket-qua.pdf', true]);
    await expect(cv.locator(`#klMinhChung-${T.id}`)).toContainText('Tệp: bao-cao-ket-qua.pdf');
    await moViec(cv, Q.id, Q.ma);
    await expect(cv.locator(`#klChiTiet-${Q.id} .ct-nhan .trang-thai`)).toHaveText('Đã nộp — chờ xác nhận', NAP);
    await expect(cv.locator(`#klChiTiet-${Q.id} .ct-nhan .trang-thai`)).not.toHaveClass(/tt-qua/);
  });

  test('2. Người giao (A2) thấy ở "Kết quả nộp trong 7 ngày"; trả lại chỉ cần lý do → nhiệm vụ mở lại', async () => {
    const [mc] = await mcCua(T.id);
    await tp.reload(); await expect(tp.locator('#mainHeader')).toBeVisible(NAP);
    await nav(tp, 'navDieuHanh');
    const dong = tp.locator(`#mcCho-${mc.id}`);
    await expect(dong).toBeVisible(NAP); await expect(dong).toContainText('hoàn thành');
    await dong.getByRole('button', { name: 'Trả lại', exact: true }).click();
    await tp.locator(`#oMc-${mc.id} [name=noi_dung]`).fill('Thiếu số liệu quý III');
    await tp.locator(`#oMc-${mc.id}`).getByRole('button', { name: 'Trả lại minh chứng' }).click();
    await expect(tp.locator('#toastContainer')).toContainText('Đã trả lại minh chứng', NAP);
    await expect.poll(async () => (await viec(T.id)).tien_do_ma, NAP).toBe('DANG_THUC_HIEN');
  });

  test('3. A3 thấy minh chứng bị trả lại, nộp lại → hoàn thành; A2 đánh giá chất lượng ở ngăn chi tiết (tuỳ chọn)', async () => {
    await moViec(cv, T.id, T.ma);
    await expect(cv.locator(`#klMinhChung-${T.id}`)).toContainText('Bị trả lại: Thiếu số liệu quý III', NAP);
    await nopTrongNgan(cv, T.id, `${khoa}/2`);
    await expect.poll(async () => (await viec(T.id)).tien_do_ma, NAP).toBe('HOAN_THANH');
    const [mc] = await mcCua(T.id);
    await moViec(tp, T.id, T.ma);
    await danhGiaMc(tp, mc.id, 'DAT_XUAT_SAC');
    expect(await viec(T.id)).toEqual({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: homNay(), chat_luong: 'DAT_XUAT_SAC' });
  });

  test('4. Minh chứng cũ đang chờ trên việc quá hạn: Đỏ tính cho lãnh đạo (DB nguoi_chiu_cham), không cho chủ trì', async () => {
    const v = (await db.from('v_nhiem_vu').select('trang_thai, nguoi_chiu_cham, phong_chiu_cham').eq('id', Q.id).single()).data;
    expect(v).toEqual({ trang_thai: 'QUA_HAN_NGHIEM_THU', nguoi_chiu_cham: ID.e2eTp, phong_chiu_cham: 'E2E_RT' });
    await tp.locator('#navCanBo').click();
    await expect(tp.locator(`#viewCanBo [data-action="moNganNguoi"][data-id="${ID.e2eTp}"]`)).toContainText('Đỏ', NAP);
  });

  test('5. Việc Thường trực giao cho Chánh VP: thư ký xác nhận minh chứng cũ thay mặt Thường trực → hoàn thành', async ({ browser }, testInfo) => {
    await cv.context().close(); cv = null;   // tối đa 2 phiên cùng lúc (docs/KIEM-THU.md)
    await datCo(db, ID.e2eTk, { thu_ky_thuong_truc: true });
    const tk = await moApp(browser, 'E2E_TK', testInfo);
    try {
      await moViec(tk, C.id, C.ma, { boCuaToi: true });
      await xacNhanMcCu(tk, (await mcCua(C.id))[0].id);
      await expect.poll(async () => (await viec(C.id)).tien_do_ma, NAP).toBe('HOAN_THANH');
      const ls = (await db.from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', C.id).eq('cot', 'dong_nhiem_vu')).data;
      expect(ls[0]?.gia_tri_moi).toMatch(/thay mặt Thường trực — Demo E2E Thư ký TT/);
    } finally { await tk.context().close(); await datCo(db, ID.e2eTk, { thu_ky_thuong_truc: false }); }
  });
});
