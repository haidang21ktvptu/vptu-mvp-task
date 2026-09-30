// PR-2b (thiết kế E2 "nghiem-thu", A4–A8, Q2, Q3, Q8, Mới 2): chủ trì A3 nộp → thấy nhãn trung tính "Đã nộp — chờ nghiệm thu" → người giao (A2) thấy
// "Cần nghiệm thu (n)" trên menu → trả lại kèm hạn nộp lại (ô chặn ngày > hạn hoàn thành) → A3 thấy hạn nộp lại, nộp lại → A2 nghiệm thu → Hoàn thành.
// Ca đã qua hạn: A3 vẫn thấy nhãn trung tính; Đỏ tính cho lãnh đạo nghiệm thu (người chịu chậm), không cho A3. Ca Chánh VP: thư ký Thường trực
// nghiệm thu thay mặt (lịch sử "thay mặt Thường trực — <tên>"). Tài khoản: demo_e2e_cv (A3 E2E_RT), demo_e2e_tp (A2 E2E_RT), demo_e2e_tk (thư ký tạm).
// Dữ liệu theo khoá riêng của project; tự dọn; cờ thư ký khôi phục ở beforeAll lẫn afterAll.
import { test, expect } from '@playwright/test';
import { NAP, moViec } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, dd, taoViec, taoMinhChung, datCo, moApp, moNghiemThu } from './lib/pr2b.mjs';

test.describe.serial('PR-2b — nghiệm thu minh chứng', () => {
  test.describe.configure({ timeout: 180_000 });   // hành trình nhiều bước, nhiều phiên (staging chậm)
  let db; let khoa; let vb; let T; let Q; let C; let cv; let tp;
  const mcCua = async (nv) => (await db.from('minh_chung').select('id, hop_le').eq('nhiem_vu_id', nv).order('nop_luc', { ascending: false })).data;

  test.beforeAll(async ({ browser }, testInfo) => {
    db = dbAdmin(); khoa = khoaRieng('NT', testInfo);
    await datCo(db, ID.e2eTk, { thu_ky_thuong_truc: false });
    vb = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN' });
    T = await taoViec(db, vb, `${khoa} T hành trình`);
    Q = await taoViec(db, vb, `${khoa} Q quá hạn nghiệm thu`, { han_xu_ly: cong(homNay(), -3), han_nop_minh_chung: cong(homNay(), -5) });
    C = await taoViec(db, vb, `${khoa} C việc Chánh VP`, { owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: ID.cvp, nguoi_theo_doi: ID.cvp, tao_boi: ID.a0 });
    await taoMinhChung(db, Q.id, ID.e2eCv, `${khoa}/Q`); await taoMinhChung(db, C.id, ID.cvp, `${khoa}/C`);
    [cv, tp] = await Promise.all([moApp(browser, 'E2E_CV', testInfo), moApp(browser, 'E2E_TP', testInfo)]);
  });
  test.afterAll(async () => {
    await cv?.context().close(); await tp?.context().close();
    if (db) { await donVanBan(db, khoa); await datCo(db, ID.e2eTk, { thu_ky_thuong_truc: false }); }
  });

  test('1. A3 nộp minh chứng → nhãn trung tính; không có mục Cần nghiệm thu; việc đã quá hạn ở bước nghiệm thu cũng trung tính', async () => {
    await expect(cv.locator('#navNghiemThu')).toHaveCount(0);
    await moViec(cv, T.id, T.ma);
    const ngan = cv.locator(`#klChiTiet-${T.id}`);
    await expect(ngan).toContainText(`Hạn nộp MC${dd(cong(homNay(), 10))}`, NAP);
    await ngan.getByRole('button', { name: 'Nộp minh chứng' }).click();
    await cv.locator('#klMcSoHieu').fill(`${khoa}/1`); await cv.locator('#klMcNgay').fill(homNay());
    await cv.locator('#klMcTrichYeu').fill('Báo cáo kết quả lần 1'); await cv.locator('#klMcMoTaKq').fill('Đã tổng hợp, gửi Trưởng phòng.');
    await cv.locator('#klMcLuu').click();
    await expect(cv.locator('#klMcModal')).toBeHidden();
    await expect(cv.locator(`#klChiTiet-${T.id} .ct-nhan .trang-thai`)).toHaveText('Đã nộp — chờ nghiệm thu', NAP);
    await moViec(cv, Q.id, Q.ma);
    await expect(cv.locator(`#klChiTiet-${Q.id} .ct-nhan .trang-thai`)).toHaveText('Đã nộp — chờ nghiệm thu', NAP);
    await expect(cv.locator(`#klChiTiet-${Q.id} .ct-nhan .trang-thai`)).not.toHaveClass(/tt-qua/);
  });

  test('2. Người giao (A2) thấy "Cần nghiệm thu (n)"; trả lại kèm hạn nộp lại (ô chặn ngày sau hạn hoàn thành)', async () => {
    await tp.reload(); await expect(tp.locator('#mainHeader')).toBeVisible(NAP);
    await expect(tp.locator('#ntBadge')).toBeVisible(NAP);
    await moNghiemThu(tp);
    const mc = (await mcCua(T.id))[0].id;
    const dong = tp.locator(`#nt-${mc}`);
    await expect(dong).toBeVisible(NAP);
    await expect(tp.locator(`#nt-${(await mcCua(Q.id))[0].id} .trang-thai`)).toHaveText(/Quá hạn ở bước nghiệm thu/);
    await dong.getByRole('button', { name: 'Trả lại' }).click();
    const han = tp.locator(`#oNt-${mc} [name=han_nop_lai]`);
    await expect(han).toHaveAttribute('max', cong(homNay(), 20));
    await tp.locator(`#oNt-${mc} [name=ly_do]`).fill('Thiếu số liệu quý III');
    await han.fill(cong(homNay(), 5));
    await tp.locator(`#oNt-${mc}`).getByRole('button', { name: 'Trả lại minh chứng' }).click();
    await expect(tp.locator('#toastContainer')).toContainText('Đã trả lại minh chứng');
    await expect(tp.locator(`#nt-${mc}`)).toHaveCount(0, NAP);
  });

  test('3. A3 thấy hạn nộp lại, nộp lại; A2 nghiệm thu → Hoàn thành (ngày = ngày văn bản)', async () => {
    await moViec(cv, T.id, T.ma);
    await expect(cv.locator(`#klMinhChung-${T.id}`)).toContainText(`nộp lại trước ${dd(cong(homNay(), 5))}`, NAP);
    await expect(cv.locator(`#klChiTiet-${T.id}`)).toContainText('(hạn nộp lại)');
    await cv.locator(`#klChiTiet-${T.id}`).getByRole('button', { name: 'Nộp minh chứng' }).click();
    await cv.locator('#klMcSoHieu').fill(`${khoa}/2`); await cv.locator('#klMcNgay').fill(homNay());
    await cv.locator('#klMcTrichYeu').fill('Báo cáo kết quả lần 2'); await cv.locator('#klMcMoTaKq').fill('Đã bổ sung số liệu quý III.');
    await cv.locator('#klMcLuu').click();
    await expect(cv.locator('#klMcModal')).toBeHidden();
    await moNghiemThu(tp);
    const mc = (await mcCua(T.id))[0].id;
    await tp.locator(`#nt-${mc}`).getByRole('button', { name: 'Nghiệm thu' }).click();
    await expect(tp.locator('#toastContainer')).toContainText('hoàn thành');
    const v = (await db.from('nhiem_vu').select('tien_do_ma, ngay_hoan_thanh').eq('id', T.id).single()).data;
    expect(v).toEqual({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: homNay() });
    await expect(tp.locator(`#nt-${mc}`)).toHaveCount(0, NAP);
  });

  test('4. Đỏ của việc quá hạn ở bước nghiệm thu tính cho lãnh đạo nghiệm thu (DB nguoi_chiu_cham), không cho chủ trì', async () => {
    const v = (await db.from('v_nhiem_vu').select('trang_thai, nguoi_chiu_cham, phong_chiu_cham').eq('id', Q.id).single()).data;
    expect(v).toEqual({ trang_thai: 'QUA_HAN_NGHIEM_THU', nguoi_chiu_cham: ID.e2eTp, phong_chiu_cham: 'E2E_RT' });
    await tp.locator('#navCanBo').click();
    await expect(tp.locator(`#viewCanBo [data-action="moNganNguoi"][data-id="${ID.e2eTp}"]`)).toContainText('Đỏ', NAP);
  });

  test('5. Việc Thường trực giao cho Chánh VP: thư ký nghiệm thu thay mặt Thường trực', async ({ browser }, testInfo) => {
    await cv.context().close(); cv = null;   // tối đa 2 phiên cùng lúc (docs/KIEM-THU.md)
    await datCo(db, ID.e2eTk, { thu_ky_thuong_truc: true });
    const tk = await moApp(browser, 'E2E_TK', testInfo);
    try {
      await moNghiemThu(tk);
      const mc = (await mcCua(C.id))[0].id;
      await tk.locator(`#nt-${mc}`).getByRole('button', { name: 'Nghiệm thu' }).click();
      await expect(tk.locator('#toastContainer')).toContainText('hoàn thành');
      const ls = (await db.from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', C.id).eq('cot', 'dong_nhiem_vu')).data;
      expect(ls[0]?.gia_tri_moi).toMatch(/thay mặt Thường trực — Demo E2E Thư ký TT/);
    } finally { await tk.context().close(); await datCo(db, ID.e2eTk, { thu_ky_thuong_truc: false }); }
  });
});
