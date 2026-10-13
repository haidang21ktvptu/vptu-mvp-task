// v3.22.1 (chủ dự án 13/10/2026): Trưởng phòng và chuyên viên có menu "Theo văn bản" — cây chỉ gồm việc trong phạm vi của người xem (RLS, không
// đổi quyền). Một văn bản mẫu (service_role) có 3 việc gốc: P1 chuyên viên demo_e2e_kl chủ trì (Tổng hợp), P2 của chuyên viên khác (Tổng hợp,
// demo_e2e_owner, Chánh VP theo dõi), P3 của demo_e2e_cv (phòng E2E_RT). Chuyên viên thấy văn bản + P1, không thấy P2, P3; dòng "đã nhập 3" vẫn là tổng thật của
// văn bản (chỉ con số); bấm P1 mở ngăn chi tiết. Trưởng phòng E2E_RT thấy P3, không thấy P1, P2. Chạy nối sau v9-nhap-excel (tài khoản đã xong
// việc ở các project trước — không dùng chung phiên). Dữ liệu tự dọn theo khoá riêng.
import { test, expect } from '@playwright/test';
import { nav, NAP } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan, kiemThayViec } from './lib/du-lieu.mjs';
import { ID, dbAdmin, taoViec, voiPhien } from './lib/pr2b.mjs';

let db; let khoa; let vbId; let p1; let p2; let p3;

test.describe.serial('Theo văn bản cho Trưởng phòng, chuyên viên (v3.22.1) — chỉ việc trong phạm vi', () => {
  test.beforeAll(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    db = dbAdmin(); khoa = khoaRieng('TVBCV', testInfo);
    vbId = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN' });
    const tongHop = { owner_don_vi_ma: 'TONG_HOP', tao_boi: ID.cvp, cap_nhan_san_pham: 'CHANH_VAN_PHONG' };
    p1 = await taoViec(db, vbId, `${khoa} P1 việc chuyên viên chủ trì`, { ...tongHop, owner_tai_khoan: ID.e2eKl, nguoi_theo_doi: ID.e2eKl });
    p2 = await taoViec(db, vbId, `${khoa} P2 việc của chuyên viên khác`, { ...tongHop, owner_tai_khoan: ID.e2eOwner, nguoi_theo_doi: ID.cvp });
    p3 = await taoViec(db, vbId, `${khoa} P3 việc phòng E2E_RT`);   // mặc định: demo_e2e_cv chủ trì, phòng E2E_RT
    await kiemThayViec('E2E_KL', p1.id, 'P1'); await kiemThayViec('E2E_TP', p3.id, 'P3');
  });
  test.afterAll(async () => { if (db) await donVanBan(db, khoa); });

  test('1. Chuyên viên: menu Theo văn bản, thấy văn bản + P1 (không thấy P2, P3), "đã nhập 3", chú thích phạm vi; bấm P1 mở ngăn chi tiết', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_KL', testInfo, async (p) => {
      await nav(p, 'navTheoVanBan');
      await expect(p.locator('#tvbCay')).toHaveAttribute('data-nap', /./, NAP);
      const goc = p.locator(`#tvbVb-${vbId}`);
      await expect(goc).toBeVisible();
      await expect(p.locator(`#tvbNv-${p1.id}`)).toBeVisible();
      await expect(p.locator(`#tvbNv-${p2.id}`)).toHaveCount(0);
      await expect(p.locator(`#tvbNv-${p3.id}`)).toHaveCount(0);
      await expect(goc).toHaveAttribute('data-so', '1');   // tiến độ theo việc người xem thấy
      await expect(goc.locator('.tvb-ra-soat')).toContainText('đã nhập 3');   // tổng thật của văn bản — chỉ con số
      await expect(p.locator('#tvbTomTat')).toContainText('việc đồng chí chủ trì, theo dõi hoặc đã giao');
      await p.locator(`#tvbNv-${p1.id} > .tvb-hang .tvb-nut`).click();
      await expect(p.locator(`#nganCT #klChiTiet-${p1.id}`)).toBeVisible(NAP);
    });
  });

  test('2. Trưởng phòng: thấy việc của phòng mình (P3), không thấy việc phòng khác (P1, P2)', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_TP', testInfo, async (p) => {
      await nav(p, 'navTheoVanBan');
      await expect(p.locator('#tvbCay')).toHaveAttribute('data-nap', /./, NAP);
      await expect(p.locator(`#tvbNv-${p3.id}`)).toBeVisible();
      await expect(p.locator(`#tvbNv-${p1.id}`)).toHaveCount(0);
      await expect(p.locator(`#tvbNv-${p2.id}`)).toHaveCount(0);
      await expect(p.locator('#tvbTomTat')).toContainText('việc của phòng đồng chí');
    });
  });
});
