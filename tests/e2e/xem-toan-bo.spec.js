// v3.23 (0103, chủ dự án 13/10/2026): cấu hình xem_toan_bo = 2 (đặt tạm bằng service_role, khôi phục) → mọi cán bộ xem toàn bộ nhiệm vụ, chỉ xem việc
// ngoài phạm vi xử lý. Văn bản mẫu: P1 demo_e2e_cv chủ trì (phòng E2E_RT, người giao demo_e2e_tp), P3 phòng Tổng hợp (ngoài phạm vi của cả
// chuyên viên lẫn Trưởng phòng E2E_RT). Kiểm: menu không còn Nhắn tin, chuyên viên có Tổng quan (Toàn Văn phòng mặc định) + Toàn bộ nhiệm vụ; P3
// ghi "Chỉ xem", ngăn chi tiết không nút ghi (cả với Trưởng phòng — không ô gửi chỉ đạo); Việc của tôi theo văn bản gốc (v3.23.1: người giao, dòng + Chi tiết, Toàn VP);
// vướng mắc gửi tới người được chọn (một tin cho đúng người); hộp Cập nhật có ô gửi tới; Giao việc có hướng dẫn hạn. Project riêng nối sau
// v3221-tvb (cấu hình chung — chạy một mình). Dữ liệu theo khoá riêng, tự dọn.
import { test, expect } from '@playwright/test';
import { NAP, nav, moGiaoViec } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan } from './lib/du-lieu.mjs';
import { ID, dbAdmin, taoViec, voiPhien } from './lib/pr2b.mjs';

let db; let khoa; let vbId; let p1; let p3; let tenTp = ''; let cauHinhCu = '1';
const datCauHinh = (v) => db.from('kl_cau_hinh').update({ gia_tri: v }).eq('khoa', 'xem_toan_bo');

test.describe.serial('Mọi cán bộ xem toàn bộ nhiệm vụ, Việc của tôi tối giản, vướng mắc gửi tới (v3.23)', () => {
  test.describe.configure({ timeout: 150_000 });
  test.beforeAll(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    db = dbAdmin(); khoa = khoaRieng('XTB', testInfo);
    const ch = await db.from('kl_cau_hinh').select('gia_tri').eq('khoa', 'xem_toan_bo').maybeSingle();
    test.skip(!ch.data, 'Project chưa có migration 0103.');
    cauHinhCu = ch.data.gia_tri;
    vbId = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN' });
    p1 = await taoViec(db, vbId, `${khoa} P1 việc chuyên viên chủ trì`);
    p3 = await taoViec(db, vbId, `${khoa} P3 việc phòng Tổng hợp`, { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: ID.e2eOwner, nguoi_theo_doi: ID.cvp,
      tao_boi: ID.cvp, cap_nhan_san_pham: 'CHANH_VAN_PHONG' });
    tenTp = (await db.from('accounts').select('full_name').eq('id', ID.e2eTp).single()).data.full_name;   // người giao P1 (tao_boi)
    const r = await datCauHinh('2'); if (r.error) throw new Error(`Đặt cấu hình thất bại: ${r.error.message}`);
  });
  test.afterAll(async () => { if (!db) return; await datCauHinh(cauHinhCu); await donVanBan(db, khoa); });

  test('1. Chuyên viên: không Nhắn tin; Tổng quan Toàn Văn phòng; Toàn bộ nhiệm vụ có P3 "Chỉ xem" (ngăn không nút ghi); Phạm vi của tôi ẩn P3', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_CV', testInfo, async (p) => {
      await expect(p.locator('#dmBubbleLauncher')).toHaveCount(0);
      await expect(p.locator('#navTongQuan')).toHaveText(/Tổng quan/);
      await nav(p, 'navTongQuan');
      await expect(p.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
      await expect(p.locator('#tqToanBo [data-tb="1"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(p.locator('#viewTongQuan')).toContainText('Toàn Văn phòng Tỉnh ủy');
      await p.locator('#tqToanBo [data-tb="0"]').click();
      await expect(p.locator('#tqToanBo [data-tb="0"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(p.locator('#navKl')).toHaveText(/Toàn bộ nhiệm vụ/);
      await nav(p, 'navKl');
      await expect(p.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
      await expect(p.locator('#klToanBo [data-tb="1"]')).toHaveAttribute('aria-pressed', 'true');
      await p.locator('#klTimKiem').fill(khoa);
      await expect(p.locator(`#klRow-${p3.id} .nhan-chi-xem`)).toBeVisible(NAP);
      await expect(p.locator(`#klRow-${p1.id}`)).toBeVisible(); await expect(p.locator(`#klRow-${p1.id} .nhan-chi-xem`)).toHaveCount(0);
      await p.locator(`#klRow-${p3.id}`).click();
      const ngan = p.locator(`#klChiTiet-${p3.id}`); await expect(ngan).toBeVisible(NAP);
      await expect(ngan.locator('[data-chi-xem]')).toBeVisible();
      await expect(ngan.getByRole('button', { name: 'Cập nhật', exact: true })).toHaveCount(0);
      await expect(ngan.locator('.nut-tang')).toHaveCount(0);
      await p.locator('#klToanBo [data-tb="0"]').click();
      await expect(p.locator(`#klRow-${p3.id}`)).toHaveCount(0); await expect(p.locator(`#klRow-${p1.id}`)).toBeVisible();
    });
  });

  test('2. Trưởng phòng ngoài phạm vi: Tổng quan (không "phòng"), P3 mở được nhưng không ô gửi chỉ đạo, không chọn cấp quyết, không Cập nhật', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_TP', testInfo, async (p) => {
      await expect(p.locator('#navTongQuan')).toHaveText(/^Tổng quan$/);
      await nav(p, 'navKl');
      await expect(p.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
      await p.locator('#klToanBo [data-tb="1"]').click();
      await p.locator('#klTimKiem').fill(khoa);
      await p.locator(`#klRow-${p3.id}`).click();
      const ngan = p.locator(`#klChiTiet-${p3.id}`); await expect(ngan).toBeVisible(NAP);
      await expect(ngan.locator(`#klChiDao-${p3.id} h4`)).toContainText('Chỉ đạo', NAP);   // khối chỉ đạo đã nạp
      await expect(ngan.locator('form.cd-form')).toHaveCount(0);
      await expect(ngan.locator('select.nl-cap')).toHaveCount(0);
      await expect(ngan.getByRole('button', { name: 'Cập nhật', exact: true })).toHaveCount(0);
      await expect(ngan.locator('[data-action="openMinhChung"]')).toHaveCount(0);
    });
  });

  test('3. Việc của tôi theo văn bản gốc (v3.23.1): người giao, dòng tối giản + Chi tiết, Toàn Văn phòng (P3 chỉ xem), lọc chủ trì; Theo văn bản ghi người giao', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_CV', testInfo, async (p) => {
      await nav(p, 'navDieuHanh');
      await expect(p.locator('#vbcCay')).toHaveAttribute('data-nap', /./, NAP);
      await expect(p.locator('#vctTom')).toContainText('việc cần làm');
      const khoi = p.locator(`#vctVb-${vbId}`); await expect(khoi).toBeVisible(NAP);
      await expect(khoi.locator('[data-truong="nguoi-giao"]')).toContainText(tenTp);
      const dong = p.locator(`#vctDong-${p1.id}`); await expect(dong).toBeVisible();
      await expect(p.locator(`#vctDong-${p3.id}`)).toHaveCount(0);
      await dong.getByRole('button', { name: 'Chi tiết', exact: true }).click();
      const ct = p.locator(`#vbcThem-${p1.id}`); await expect(ct).toBeVisible(); await expect(ct).toContainText('Người giao');
      await expect(ct.getByRole('button', { name: 'Cập nhật', exact: true })).toBeVisible();
      await p.locator('#vbcPhamVi [data-pv="toan"]').click();
      await p.locator('#vbcTim').fill(khoa);
      await expect(p.locator(`#vctVb-${vbId}`)).toHaveAttribute('data-mo', '1', NAP);   // toàn Văn phòng gập sẵn — đang tìm thì mở
      await expect(p.locator(`#vctDong-${p3.id} .nhan-chi-xem`)).toBeVisible(NAP);
      await p.locator(`#vctDong-${p3.id} .vbc-nut-ct`).click();
      await expect(p.locator(`#vbcThem-${p3.id}`).getByRole('button', { name: 'Mở ngăn chi tiết' })).toBeVisible();
      await expect(p.locator(`#vbcThem-${p3.id}`).getByRole('button', { name: 'Cập nhật', exact: true })).toHaveCount(0);
      await p.locator('select[data-vbc-loc="chuTri"]').selectOption(ID.e2eOwner);
      await expect(p.locator(`#vctDong-${p1.id}`)).toHaveCount(0); await expect(p.locator(`#vctDong-${p3.id}`)).toBeVisible();
      await nav(p, 'navTheoVanBan');
      await expect(p.locator('#tvbCay')).toHaveAttribute('data-nap', /./, NAP);
      await expect(p.locator(`#tvbVb-${vbId} [data-truong="nguoi-giao"]`)).toContainText(tenTp);
    });
  });

  test('4. Vướng mắc gửi tới người được chọn (một tin cho đúng người); hộp Cập nhật có ô gửi tới; Giao việc có hướng dẫn hạn', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_CV', testInfo, async (p) => {
      await nav(p, 'navKl');
      await expect(p.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
      await p.locator('#klTimKiem').fill(khoa);
      await p.locator(`#klRow-${p1.id}`).click();
      const ngan = p.locator(`#klChiTiet-${p1.id}`); await expect(ngan).toBeVisible(NAP);
      await ngan.locator(`[data-action="moO"][data-o="oVm-${p1.id}"]`).click();
      const form = p.locator(`#oVm-${p1.id}`);
      await form.locator('textarea[name="vuong_mac"]').fill(`${khoa} cần ý kiến về số liệu`);
      await form.locator('select[name="gui_cho"]').selectOption(ID.e2eTp);
      await form.locator('button[type="submit"]').click();
      await expect(p.locator('#toastContainer')).toContainText('gửi đề nghị xử lý tới đồng chí', NAP);
      await expect(p.locator(`#klChiTiet-${p1.id} [data-truong="vuong-mac-gui-toi"]`)).toBeVisible(NAP);
      expect((await db.from('nhiem_vu').select('vuong_mac_gui_cho').eq('id', p1.id).single()).data.vuong_mac_gui_cho).toBe(ID.e2eTp);
      const tin = (await db.from('direct_messages').select('receiver_id').eq('nhiem_vu_id', p1.id).like('content', 'Đề nghị đồng chí xử lý vướng mắc%')).data;
      expect(tin.map((t) => t.receiver_id)).toEqual([ID.e2eTp]);
      await p.locator(`#klChiTiet-${p1.id}`).getByRole('button', { name: 'Cập nhật', exact: true }).click();
      await expect(p.locator('#klCnVmGuiCho')).toHaveValue(ID.e2eTp);
      await p.locator('#klCapNhatModal [data-action="closeKlCapNhat"]').click();
      await moGiaoViec(p);
      await expect(p.locator('#gvGoiYHan')).toContainText('không xác định được thời hạn');
    });
  });
});
