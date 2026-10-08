// PR-2b (thiết kế E2 "b4-b6-lanh-dao"; khoảng trống mục 4 ma trận kiểm thử giai đoạn 1) → Đợt D v3.20 (0090, định hướng 8/10/2026): lãnh đạo /
// quản trị là NGƯỜI THEO DÕI cũng đi đủ B4 nhận việc → B5 nộp minh chứng (= hoàn thành) → B6 lãnh đạo cấp trên đánh giá chất lượng (tuỳ chọn):
//   PCVP chủ trì việc Thường trực giao (theo dõi = chính PCVP, "đã nhận" tự động — lãnh đạo không bấm) → Chánh VP đánh giá;
//   Trưởng phòng theo dõi việc Thường trực giao cho phòng ("đã nhận" tự động) → PCVP phụ trách phòng đánh giá;
//   A3 giữ quan_tri_kl (demo_e2e_owner, cờ tạm) theo dõi việc đơn vị ngoài do mình giao thay mặt Trưởng phòng (chuyên viên vẫn bấm nhận việc) →
//   Trưởng phòng đánh giá. Mọi thao tác trên ngăn chi tiết. Dữ liệu theo khoá; cờ khôi phục. Một phiên mở mỗi lúc (docs/KIEM-THU.md).
import { test, expect } from '@playwright/test';
import { NAP, moViec } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, taoViec, datCo, danhGiaMc, voiPhien } from './lib/pr2b.mjs';

test.describe.serial('PR-2b / Đợt D — B4–B6: lãnh đạo, quản trị là người theo dõi', () => {
  test.describe.configure({ timeout: 180_000 });   // hành trình nhiều bước (staging chậm)
  let db; let khoa; let P; let R; let Q;

  async function nhanVaNop(page, v, so, laLanhDao) {
    await moViec(page, v.id, v.ma);
    const ngan = page.locator(`#klChiTiet-${v.id}`);
    if (laLanhDao) await expect(ngan.getByRole('button', { name: 'Xác nhận đã nhận việc' })).toHaveCount(0);   // 0090: đã nhận tự động
    else await ngan.getByRole('button', { name: 'Xác nhận đã nhận việc' }).click();
    await expect(page.locator(`#klChiTiet-${v.id}`)).toContainText('đã nhận việc', NAP);
    await page.locator(`#klChiTiet-${v.id}`).getByRole('button', { name: 'Nộp minh chứng' }).click();
    await page.locator('#klMcSoHieu').fill(so); await page.locator('#klMcNgay').fill(homNay());
    await page.locator('#klMcTrichYeu').fill('Báo cáo kết quả (B5)'); await page.locator('#klMcMoTaKq').fill('Đã thực hiện, gửi lãnh đạo.');
    await page.locator('#klMcLuu').click(); await expect(page.locator('#klMcModal')).toBeHidden();
    await expect(page.locator(`#klChiTiet-${v.id} .ct-nhan .trang-thai`)).toHaveText(/^Hoàn thành/, NAP);
    expect((await db.from('nhiem_vu').select('tien_do_ma').eq('id', v.id).single()).data.tien_do_ma).toBe('HOAN_THANH');
  }
  async function danhGia(page, v) {
    await moViec(page, v.id, v.ma);
    const mc = (await db.from('minh_chung').select('id').eq('nhiem_vu_id', v.id).single()).data.id;
    await danhGiaMc(page, mc, 'DAT_TOT');
    expect((await db.from('nhiem_vu').select('chat_luong').eq('id', v.id).single()).data.chat_luong).toBe('DAT_TOT');
  }
  const hanhTrinh = async (browser, testInfo, nguoiNop, nguoiDanhGia, v, so, laLanhDao) => {
    await voiPhien(browser, nguoiNop, testInfo, (p) => nhanVaNop(p, v, so, laLanhDao));
    await voiPhien(browser, nguoiDanhGia, testInfo, (p) => danhGia(p, v));
  };

  test.beforeAll(async () => {
    db = dbAdmin(); khoa = khoaRieng('B46', test.info());
    await datCo(db, ID.e2eOwner, { quan_tri_kl: true });
    const vb = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN', ngay_ban_hanh: homNay() });
    P = await taoViec(db, vb, `${khoa} P PCVP chủ trì`, { owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: ID.pcvp, nguoi_theo_doi: ID.pcvp, tao_boi: ID.a0 });
    R = await taoViec(db, vb, `${khoa} R phòng Tổng hợp`, { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: null, nguoi_theo_doi: ID.tp, tao_boi: ID.a0 });
    Q = await taoViec(db, vb, `${khoa} Q quản trị theo dõi`, { owner_don_vi_ma: 'DANG_UY_UBND', owner_tai_khoan: null, nguoi_theo_doi: ID.e2eOwner,
      tao_boi: ID.e2eOwner, giao_thay_mat_cho: ID.tp });
  });
  test.afterAll(async () => {
    if (db) { await donVanBan(db, khoa); await datCo(db, ID.e2eOwner, { quan_tri_kl: false }); }
  });

  test('1. PCVP chủ trì (đã nhận tự động): nộp → hoàn thành → Chánh VP đánh giá', async ({ browser }, testInfo) => {
    await hanhTrinh(browser, testInfo, 'PCVP', 'A1', P, `${khoa}/P`, true);
  });
  test('2. Trưởng phòng theo dõi việc của phòng (đã nhận tự động): nộp → hoàn thành → PCVP phụ trách phòng đánh giá', async ({ browser }, testInfo) => {
    await hanhTrinh(browser, testInfo, 'A2', 'PCVP', R, `${khoa}/R`, true);
  });
  test('3. A3 giữ quan_tri_kl theo dõi việc đơn vị ngoài (giao thay mặt Trưởng phòng): nhận việc, nộp → hoàn thành → Trưởng phòng đánh giá', async ({ browser }, testInfo) => {
    await hanhTrinh(browser, testInfo, 'E2E_OWNER', 'A2', Q, `${khoa}/Q`, false);
  });
});
