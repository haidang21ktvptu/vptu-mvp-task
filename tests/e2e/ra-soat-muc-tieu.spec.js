// v3.25 — Rà soát mục tiêu then chốt (0110–0111). Trưởng phòng E2E_RT (demo_e2e_tp — người giao các việc mẫu) mở "Rà soát mục tiêu then chốt" từ
// danh sách Nhiệm vụ: việc nhắc "Nghị quyết số 57-NQ/TW" có Nghị quyết 57-NQ/TW TÍCH SẴN (bộ nhận diện của DB, quy tắc số hiệu 0113), việc không khớp
// quy tắc nào không có gì để chấp nhận; Chấp nhận một việc → DB gắn NQ_57 nguồn RA_SOAT, dòng "Đã lưu", "Đang tính" đổi theo. Văn bản + việc theo
// khoá riêng, tự dọn. Chạy một mình (project v325-ra-soat, nối sau v324-tong-quan) vì ghi mục tiêu.
import { test, expect } from '@playwright/test';
import { pageAs, nav, NAP } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan, kiemThayViec } from './lib/du-lieu.mjs';
import { dbAdmin, taoViec } from './lib/pr2b.mjs';

test.describe.serial('Rà soát mục tiêu then chốt (v3.25)', () => {
  test.describe.configure({ timeout: 120_000 });
  let db; let khoa; let v1; let v2;
  test.beforeAll(async () => {
    db = dbAdmin(); khoa = khoaRieng('RSMT', test.info());
    test.skip(Boolean((await db.rpc('goi_y_muc_tieu', { p: {} })).error), 'Project chưa có migration 0110 (goi_y_muc_tieu).');
    const vbId = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN' });   // KL_BTV (mặc định) bắt buộc số hội nghị
    v1 = await taoViec(db, vbId, `${khoa} thực hiện Nghị quyết số 57-NQ/TW của Bộ Chính trị`);
    v2 = await taoViec(db, vbId, `${khoa} việc đối chứng không khớp quy tắc nào`);
    await kiemThayViec('E2E_TP', v1.id, 'việc có số hiệu');
  });
  test.afterAll(async () => { if (db && khoa) await donVanBan(db, khoa); });

  test('Mở từ Nhiệm vụ; mục tích sẵn theo số hiệu; Chấp nhận một việc → DB nguồn RA_SOAT, dòng Đã lưu', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'E2E_TP', testInfo);
    await nav(page, 'navKl');
    await expect(page.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
    await page.locator('#klRaSoatMt').click();
    await expect(page.locator('#viewRaSoatMucTieu')).toBeVisible();
    await expect(page.locator('#rsDs')).toHaveAttribute('data-nap', /./, NAP);
    await page.locator('#rsTim').fill(khoa);
    const d1 = page.locator(`#rsDong-${v1.id}`); const d2 = page.locator(`#rsDong-${v2.id}`);
    await expect(d1).toBeVisible(NAP); await expect(d2).toBeVisible();
    await expect(d1.locator('.mtg-chip[data-nguon="QUY_TAC"]'), 'số hiệu nghị quyết trong nội dung → tích sẵn').toContainText('Nghị quyết 57-NQ/TW', NAP);
    await expect(d1.locator('[data-rs-tt]')).toHaveText('Mục tích sẵn chờ chấp nhận');
    await expect(d1.locator('[data-action="rsLuu"]')).toBeEnabled();
    await expect(d2.locator('[data-rs-tt]')).toHaveText('Không có mục nào cần chấp nhận', NAP);
    await expect(d2.locator('[data-action="rsLuu"]')).toBeDisabled();

    await d1.locator('[data-action="rsLuu"]').click();
    await expect(page.locator('#toastContainer')).toContainText('Đã gắn mục tiêu then chốt cho 1 việc', NAP);
    await expect(d1.locator('[data-rs-tt]')).toHaveText('Đã lưu');
    await expect(d1.locator('[data-rs-hien]')).toContainText('Nghị quyết 57-NQ/TW');
    await expect(d1.locator('[data-action="rsLuu"]')).toBeDisabled();
    const m = await db.from('nhiem_vu_muc_tieu').select('muc_tieu_ma, nguon').eq('nhiem_vu_id', v1.id);
    expect(m.data, 'gắn đúng mục, nguồn chấp nhận khi rà soát').toEqual([{ muc_tieu_ma: 'NQ_57', nguon: 'RA_SOAT' }]);
    expect((await db.from('nhiem_vu_muc_tieu').select('muc_tieu_ma').eq('nhiem_vu_id', v2.id)).data).toEqual([]);
    await page.context().close();
  });
});
