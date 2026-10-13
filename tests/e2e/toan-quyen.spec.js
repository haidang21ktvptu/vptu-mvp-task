// v3.22 (0100): tài khoản toàn quyền — demo_e2e_tq (A3, CDS_CY, seed) được bật cờ toan_quyen + quan_tri_he_thong (như qt_vptu) bằng service_role lúc chạy, thu lại ở afterAll
// (như thư ký Thường trực). Chỉ đọc giao diện, không ghi việc (chạy song song project desktop, không đụng số liệu của spec khác): chức danh
// "Quản trị toàn quyền", menu như Chánh Văn phòng + Quản trị, Tổng quan toàn Văn phòng, biểu mẫu Giao việc chọn được mọi phòng / lãnh đạo và
// không có ô Thay mặt. Bỏ qua khi project chưa có tài khoản (seed-demo.mjs) hoặc chưa có migration 0100.
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { NAP, moGiaoViec } from './lib/app.js';
import { storageStatePath } from './lib/roles.mjs';
import { ID, dbAdmin, datCo, voiPhien } from './lib/pr2b.mjs';

const TQ_ID = '00000000-0000-4000-8000-000000000020';   // demo_e2e_tq
let db;

test.describe.serial('Tài khoản toàn quyền (v3.22, 0100)', () => {
  test.beforeAll(async () => {
    test.skip(!existsSync(storageStatePath('E2E_TQ')), 'Chưa có demo_e2e_tq trên project này (seed-demo.mjs).');
    db = dbAdmin();
    const co = await db.from('accounts').select('toan_quyen').eq('id', TQ_ID).maybeSingle();
    test.skip(Boolean(co.error), 'Project chưa có migration 0100.');
    await datCo(db, TQ_ID, { toan_quyen: true, quan_tri_he_thong: true });   // như qt_vptu (giữ cờ quản trị hệ thống)
  });
  test.afterAll(async () => { if (db) await datCo(db, TQ_ID, { toan_quyen: false, quan_tri_he_thong: false }); });

  test('1. Chức danh "Quản trị toàn quyền"; menu như Chánh Văn phòng + Quản trị; Tổng quan toàn Văn phòng', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_TQ', testInfo, async (p) => {
      await expect(p.locator('#currentRoleDisplay')).toHaveText('Quản trị toàn quyền', NAP);
      for (const id of ['navTongQuan', 'navDieuHanh', 'navGiaoViec', 'navKl', 'navTheoVanBan', 'navCanBo', 'navBaoCao', 'navQuanTri']) {
        await expect(p.locator(`#${id}`), id).toHaveCount(1);
      }
      await expect(p.locator('#navTheoDoi'), 'không còn menu chuyên viên').toHaveCount(0);
      await expect(p.locator('#viewTongQuan')).toBeVisible(NAP);
      await expect(p.locator('#viewTongQuan')).toContainText('Văn phòng Tỉnh ủy', NAP);
    });
  });

  test('2. Giao việc: Chịu trách nhiệm chọn được mọi phòng và lãnh đạo; không có ô Thay mặt', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_TQ', testInfo, async (p) => {
      await moGiaoViec(p);
      await expect(p.locator('#klThThayMatWrap')).toBeHidden();
      for (const v of ['dv:TONG_HOP', 'dv:QUAN_TRI', `tk:${ID.pcvp}`, `tk:${ID.tp}`, `tk:${ID.cvp}`]) {
        await expect(p.locator(`#klThOwner option[value="${v}"]`), v).toHaveCount(1, NAP);
      }
    });
  });
});
