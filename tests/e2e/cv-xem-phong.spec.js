// Đợt C1 v3.19 (0086): cấu hình pham_vi_chuyen_vien = 2 (đặt tạm bằng service_role, khôi phục) → chuyên viên demo_e2e_cv (A3, phòng E2E_RT) có
// menu "Tổng quan phòng" + "Nhiệm vụ của phòng" (nút Việc của tôi / Cả phòng), thấy việc P1 của chuyên viên khác cùng phòng (chỉ xem: ngăn chi
// tiết không có Cập nhật / Nộp minh chứng), Tổng quan phòng có thanh lọc + khối Theo loại văn bản; việc P2 của mình: một hộp "Cập nhật" gộp
// "Nộp minh chứng nhanh" (số hiệu + ngày; cấp nhận mặc định theo việc) → Lưu → minh chứng chờ nghiệm thu. Một phiên mỗi lúc; dữ liệu theo khoá; tự dọn.
import { test, expect } from '@playwright/test';
import { NAP, nav } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan, kiemThayViec } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, taoViec, voiPhien } from './lib/pr2b.mjs';

const E2E_CV2 = '00000000-0000-4000-8000-000000000017';   // demo_e2e_cv2 — A3 cùng phòng E2E_RT, không đăng nhập
let db; let khoa; let cauHinhCu = '1'; let p1; let p2;
const datCauHinh = (v) => db.from('kl_cau_hinh').update({ gia_tri: v }).eq('khoa', 'pham_vi_chuyen_vien');

test.describe.serial('Chuyên viên xem cả phòng và cập nhật kèm minh chứng nhanh (v3.19 Đợt C1)', () => {
  test.describe.configure({ timeout: 150_000 });
  test.beforeAll(async () => {
    db = dbAdmin(); khoa = khoaRieng('CXP', test.info());
    const ch = await db.from('kl_cau_hinh').select('gia_tri').eq('khoa', 'pham_vi_chuyen_vien').maybeSingle();
    test.skip(!ch.data, 'Project chưa có migration 0086.');
    cauHinhCu = ch.data.gia_tri;
    const vbId = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN' });
    p1 = await taoViec(db, vbId, `${khoa} P1 việc của chuyên viên khác cùng phòng`, { owner_tai_khoan: E2E_CV2, nguoi_theo_doi: ID.e2eTp });
    p2 = await taoViec(db, vbId, `${khoa} P2 việc của tôi`, { han_xu_ly: cong(homNay(), 15) });
    await kiemThayViec('E2E_CV', p2.id, 'P2 (việc của tôi)');
    const r = await datCauHinh('2'); if (r.error) throw new Error(`Đặt cấu hình thất bại: ${r.error.message}`);
    await kiemThayViec('E2E_CV', p1.id, 'P1 (cả phòng, cấu hình 2)');
  });
  test.afterAll(async () => { if (!db) return; await datCauHinh(cauHinhCu); await donVanBan(db, khoa); });

  test('1. Nhiệm vụ của phòng: nút phạm vi, thấy P1 của người khác cùng phòng (chỉ xem), Việc của tôi chỉ còn P2', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_CV', testInfo, async (p) => {
      await expect(p.locator('#navTongQuan')).toHaveText(/Tổng quan phòng/);
      await expect(p.locator('#navKl')).toHaveText(/Nhiệm vụ của phòng/);
      await nav(p, 'navKl');
      await expect(p.locator('#klTieuDe')).toHaveText('Nhiệm vụ của phòng');
      await expect(p.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
      await expect(p.locator('#klPhamVi button[data-pv="phong"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(p.locator(`#klRow-${p1.id}`)).toBeVisible(NAP); await expect(p.locator(`#klRow-${p2.id}`)).toBeVisible();
      await p.locator('#klPhamVi button[data-pv="toi"]').click();
      await expect(p.locator(`#klRow-${p1.id}`)).toHaveCount(0); await expect(p.locator(`#klRow-${p2.id}`)).toBeVisible();
      await expect(p.locator('#klChipLoc')).toContainText('Việc của tôi');
      await p.locator('#klPhamVi button[data-pv="phong"]').click();
      await expect(p.locator(`#klRow-${p1.id}`)).toBeVisible();
      await p.locator(`#klRow-${p1.id}`).click();
      const ngan = p.locator(`#klChiTiet-${p1.id}`); await expect(ngan).toBeVisible(NAP);
      await expect(ngan.getByRole('button', { name: 'Cập nhật' })).toHaveCount(0);
      await expect(ngan.getByRole('button', { name: 'Nộp minh chứng' })).toHaveCount(0);
      await expect(ngan.getByRole('button', { name: 'Xác nhận đã nhận việc' })).toHaveCount(0);
    });
  });

  test('2. Tổng quan phòng: thanh lọc, khối Theo loại văn bản, chip loại lọc cả màn hình, quy tắc cảnh báo', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_CV', testInfo, async (p) => {
      await nav(p, 'navTongQuan');
      await expect(p.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
      await expect(p.locator('#viewTongQuan h1')).toContainText('Tổng quan');
      await expect(p.locator('#tqQuyTac')).toContainText('Quy tắc');
      await expect(p.locator('#tqLoaiVanBan')).toBeVisible(); await expect(p.locator('#tqLocPhong')).toHaveCount(0);   // chuyên viên không có ô Phòng
      await p.locator('#tqLoc .chip-loai button[data-loai="CONG_VAN"]').click();
      await expect(p.locator('#tqDangLoc')).toContainText('Đang lọc');
      await expect(p.locator('#tqLoc .chip-loai button[data-loai="CONG_VAN"]')).toHaveAttribute('aria-pressed', 'true');
      await p.locator('#tqLoc .tq-loc-bo').click();
      await expect(p.locator('#tqDangLoc')).not.toContainText('Đang lọc');
    });
  });

  test('3. Việc của tôi (P2): hộp Cập nhật có mục Nộp minh chứng nhanh — cấp nhận mặc định theo việc; Lưu → minh chứng chờ nghiệm thu', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_CV', testInfo, async (p) => {
      await nav(p, 'navKl');
      await expect(p.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
      await p.locator(`#klRow-${p2.id}`).click();
      const ngan = p.locator(`#klChiTiet-${p2.id}`); await expect(ngan).toBeVisible(NAP);
      await ngan.getByRole('button', { name: 'Cập nhật' }).click();
      await expect(p.locator('#klCapNhatModal')).toBeVisible();
      await expect(p.locator('#klCnMcWrap')).toBeVisible();
      await expect(p.locator('#klCnMcCap')).toHaveValue('TRUONG_PHONG');
      await p.locator('#klCnMcSoHieu').fill('21/BC-E2E');
      await p.locator('#klCnLuu').click();
      await expect(p.locator('#toastContainer')).toContainText('số hiệu và ngày văn bản');   // thiếu ngày → chặn ở form, hộp vẫn mở
      await expect(p.locator('#klCapNhatModal')).toBeVisible();
      await p.locator('#klCnMcNgay').fill(homNay());
      await p.locator('#klCnLuu').click();
      await expect(p.locator('#toastContainer')).toContainText('nộp minh chứng số 21/BC-E2E', NAP);
      await expect(p.locator('#klCapNhatModal')).toBeHidden();
      await expect(p.locator(`#klMinhChung-${p2.id}`)).toContainText('21/BC-E2E', NAP);
    });
    const { data: mc } = await db.from('minh_chung').select('so_hieu, cap_nhan, trich_yeu, mo_ta_ket_qua, nop_boi').eq('nhiem_vu_id', p2.id);
    expect(mc).toEqual([{ so_hieu: '21/BC-E2E', cap_nhan: 'TRUONG_PHONG', trich_yeu: null, mo_ta_ket_qua: null, nop_boi: ID.e2eCv }]);
    const { data: nv } = await db.from('v_nhiem_vu').select('nhom_dem').eq('id', p2.id).single();
    expect(nv.nhom_dem).toBe('CHO_NGHIEM_THU');
  });
});
