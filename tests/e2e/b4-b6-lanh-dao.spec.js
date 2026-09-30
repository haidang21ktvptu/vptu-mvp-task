// PR-2b (thiết kế E2 "b4-b6-lanh-dao"; khoảng trống mục 4 ma trận kiểm thử giai đoạn 1): lãnh đạo / quản trị là NGƯỜI THEO DÕI cũng đi đủ B4 nhận việc
// → B5 nộp minh chứng → B6 được lãnh đạo nhận nhắc chính nghiệm thu (đóng luôn — Q2):
//   PCVP chủ trì việc Thường trực giao (theo dõi = chính PCVP) → Chánh VP nghiệm thu;
//   Trưởng phòng theo dõi việc Thường trực giao cho phòng → PCVP phụ trách phòng nghiệm thu;
//   A3 giữ quan_tri_kl (demo_e2e_owner, cờ tạm) theo dõi việc đơn vị ngoài do mình giao thay mặt Trưởng phòng → Trưởng phòng nghiệm thu.
// Mọi thao tác trên ngăn chi tiết (Xác nhận đã nhận việc, Nộp minh chứng) và màn "Cần nghiệm thu". Dữ liệu theo khoá; cờ khôi phục.
import { test, expect } from '@playwright/test';
import { NAP, moViec } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, taoViec, datCo, moApp, moNghiemThu } from './lib/pr2b.mjs';

test.describe.serial('PR-2b — B4–B6: lãnh đạo, quản trị là người theo dõi', () => {
  test.describe.configure({ timeout: 180_000 });   // hành trình nhiều bước, nhiều phiên (staging chậm)
  let db; let khoa; let P; let R; let Q; const trang = {};

  async function nhanVaNop(page, v, so) {
    await moViec(page, v.id, v.ma);
    const ngan = page.locator(`#klChiTiet-${v.id}`);
    await ngan.getByRole('button', { name: 'Xác nhận đã nhận việc' }).click();
    await expect(page.locator(`#klChiTiet-${v.id}`)).toContainText('đã nhận việc', NAP);
    await page.locator(`#klChiTiet-${v.id}`).getByRole('button', { name: 'Nộp minh chứng' }).click();
    await page.locator('#klMcSoHieu').fill(so); await page.locator('#klMcNgay').fill(homNay());
    await page.locator('#klMcTrichYeu').fill('Báo cáo kết quả (B5)'); await page.locator('#klMcMoTaKq').fill('Đã thực hiện, gửi lãnh đạo.');
    await page.locator('#klMcLuu').click(); await expect(page.locator('#klMcModal')).toBeHidden();
    await expect(page.locator(`#klChiTiet-${v.id} .ct-nhan .trang-thai`)).toHaveText('Đã nộp — chờ nghiệm thu', NAP);
  }
  async function nghiemThu(page, v) {
    await moNghiemThu(page);
    const mc = (await db.from('minh_chung').select('id').eq('nhiem_vu_id', v.id).single()).data.id;
    await page.locator(`#nt-${mc}`).getByRole('button', { name: 'Nghiệm thu' }).click();
    await expect(page.locator('#toastContainer')).toContainText(`${v.ma} hoàn thành`, NAP);
    expect((await db.from('nhiem_vu').select('tien_do_ma').eq('id', v.id).single()).data.tien_do_ma).toBe('HOAN_THANH');
  }

  test.beforeAll(async ({ browser }, testInfo) => {
    db = dbAdmin(); khoa = khoaRieng('B46', testInfo);
    await datCo(db, ID.e2eOwner, { quan_tri_kl: true });
    const vb = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN', ngay_ban_hanh: homNay() });
    P = await taoViec(db, vb, `${khoa} P PCVP chủ trì`, { owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: ID.pcvp, nguoi_theo_doi: ID.pcvp, tao_boi: ID.a0 });
    R = await taoViec(db, vb, `${khoa} R phòng Tổng hợp`, { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: null, nguoi_theo_doi: ID.tp, tao_boi: ID.a0 });
    Q = await taoViec(db, vb, `${khoa} Q quản trị theo dõi`, { owner_don_vi_ma: 'DANG_UY_UBND', owner_tai_khoan: null, nguoi_theo_doi: ID.e2eOwner,
      tao_boi: ID.e2eOwner, giao_thay_mat_cho: ID.tp });
    const ds = await Promise.all(['PCVP', 'A1', 'A2', 'E2E_OWNER'].map((r) => moApp(browser, r, testInfo)));
    [trang.pcvp, trang.cvp, trang.tp, trang.qt] = ds;
  });
  test.afterAll(async () => {
    await Promise.all(Object.values(trang).map((p) => p.context().close()));
    if (db) { await donVanBan(db, khoa); await datCo(db, ID.e2eOwner, { quan_tri_kl: false }); }
  });

  test('1. PCVP chủ trì: nhận việc, nộp → Chánh VP nghiệm thu', async () => {
    await nhanVaNop(trang.pcvp, P, `${khoa}/P`);
    await nghiemThu(trang.cvp, P);
  });
  test('2. Trưởng phòng theo dõi việc của phòng: nhận việc, nộp → PCVP phụ trách phòng nghiệm thu', async () => {
    await nhanVaNop(trang.tp, R, `${khoa}/R`);
    await nghiemThu(trang.pcvp, R);
  });
  test('3. A3 giữ quan_tri_kl theo dõi việc đơn vị ngoài (giao thay mặt Trưởng phòng): nhận việc, nộp → Trưởng phòng nghiệm thu', async () => {
    await nhanVaNop(trang.qt, Q, `${khoa}/Q`);
    await nghiemThu(trang.tp, Q);
  });
});
