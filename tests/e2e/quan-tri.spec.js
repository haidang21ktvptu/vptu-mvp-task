// Kịch bản 8 (GĐ8, thiết kế KL BTVTU Phần 5): tài khoản có quan_tri_he_thong thấy mục "Quản trị hệ thống",
// cấp rồi thu quyền quản trị KL cho demo_cv2 qua hộp lý do (bắt buộc), nhật ký hiện đúng hai dòng;
// tài khoản thường (A3) không có mục này. GĐ9 PR 9A: bảng phụ trách có nút "Kiêm nhiệm lĩnh vực", hộp chọn
// ngành → lĩnh vực khoá theo ngành. Tự bỏ qua khi project chưa có demo_qtht (trước khi merge 0013) hoặc chưa có
// dm_linh_vuc (trước khi merge 0018 — màn hình đọc cột mới của phu_trach_phong).
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs } from './lib/app.js';
import { OPTIONAL_USERS, storageStatePath } from './lib/roles.mjs';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';

const CV2_ID = '00000000-0000-4000-8000-000000000005';

function dbAdmin() {
  const k = getKeys();
  return createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function pageAsQtht(browser, testInfo) {
  const { viewport, isMobile, hasTouch, baseURL, locale } = testInfo.project.use;
  const context = await browser.newContext({ viewport, isMobile, hasTouch, baseURL, locale, storageState: storageStatePath('QTHT') });
  const page = await context.newPage();
  await page.goto('./');
  await expect(page.locator('#currentUserDisplay')).toContainText(OPTIONAL_USERS.QTHT.fullName);
  return page;
}

test.describe.serial('Quản trị hệ thống: cấp/thu quyền quản trị KL có lý do', () => {
  // Kiểm lúc chạy (sau global-setup), không kiểm lúc nạp file: phiên demo_qtht do global-setup tạo.
  let coLinhVuc = false;
  test.beforeAll(async () => {
    coLinhVuc = !(await dbAdmin().from('dm_linh_vuc').select('ma').limit(1)).error;
  });
  test.beforeEach(() => {
    test.skip(!existsSync(storageStatePath('QTHT')), 'Chưa có demo_qtht trên project này (chạy sau khi merge 0013 + nạp seed).');
    test.skip(!coLinhVuc, 'Chưa có migration 0018 (dm_linh_vuc) trên project này — chạy sau khi merge.');
  });

  test.afterAll(async () => {
    // Thu về trạng thái seed dù test lỗi giữa chừng (service_role, dữ liệu giả).
    await dbAdmin().from('accounts').update({ quan_tri_kl: false }).eq('id', CV2_ID);
  });

  test('A3 thường không có mục Quản trị hệ thống', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A3', testInfo);
    await expect(page.locator('#navQuanTri')).toHaveCount(0);
    await page.context().close();
  });

  test('QTHT cấp rồi thu quyền cho demo_cv2, lý do bắt buộc, nhật ký ghi hai dòng', async ({ browser }, testInfo) => {
    const page = await pageAsQtht(browser, testInfo);
    await page.locator('#navQuanTri').click();
    await expect(page.locator('#viewQuanTri')).toBeVisible();
    await expect(page.locator('#viewKl')).toBeHidden();
    const row = page.locator('#qtTaiKhoanBody tr', { hasText: 'demo_cv2' });
    await expect(row).toContainText('Không');

    // Cấp quyền: bỏ trống lý do → bị chặn; ghi lý do → cờ đổi, toast, nhật ký.
    const lyDo = `${E2E_TAG} ${testInfo.project.name} ${Date.now()}`;
    await row.getByRole('button', { name: /Cấp quyền/ }).click();
    await expect(page.locator('#qtLyDoModal')).toBeVisible();
    await page.locator('#qtLyDoXacNhan').click();
    await expect(page.locator('#toastContainer')).toContainText('Phải ghi lý do');
    await page.locator('#qtLyDo').fill(lyDo);
    await page.locator('#qtLyDoXacNhan').click();
    await expect(page.locator('#toastContainer')).toContainText('Đã cấp quyền quản trị KL BTVTU cho Demo Chuyên viên Hai.');
    await expect(row).toContainText('Có quyền');
    await expect(page.locator('#qtNhatKyBody tr').first()).toContainText(lyDo);
    await expect(page.locator('#qtNhatKyBody tr').first()).toContainText('Bật');

    // Thu quyền.
    await row.getByRole('button', { name: /Thu quyền/ }).click();
    await page.locator('#qtLyDo').fill(`${lyDo} thu`);
    await page.locator('#qtLyDoXacNhan').click();
    await expect(page.locator('#toastContainer')).toContainText('Đã thu quyền quản trị KL BTVTU của Demo Chuyên viên Hai.');
    await expect(row).toContainText('Không');
    await expect(page.locator('#qtNhatKyBody tr').first()).toContainText('Tắt');
    await expect(page.locator('#qtCanhBao')).toContainText('Đang có 0 người giữ quyền quản trị KL BTVTU (quy định: 2).');

    // Bảng phụ trách phòng: Chánh VP cố định, 2 PCVP có ô đang phụ trách theo seed.
    await expect(page.locator('#qtPhuTrachBody')).toContainText('Chánh Văn phòng — phụ trách mọi phòng');
    await expect(page.locator('#qtPhuTrachBody button[data-username="demo_pcvp"][data-phong="TONG_HOP"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#qtPhuTrachBody button[data-username="demo_pcvp2"][data-phong="TONG_HOP"]')).toHaveAttribute('aria-checked', 'false');

    // Kiêm nhiệm lĩnh vực (GĐ9 PR 9A): hộp mở đúng PCVP, chọn ngành 8 → 4 lĩnh vực khoá theo ngành; Huỷ không ghi gì.
    await page.locator('#qtPhuTrachBody button[data-action="moKiemNhiem"][data-username="demo_pcvp2"]').click();
    await expect(page.locator('#qtKiemNhiemModal')).toBeVisible();
    await expect(page.locator('#qtKnMoTa')).toContainText('Demo Phó Chánh Văn phòng Hai');
    await page.locator('#qtKnNganh').selectOption('KINH_TE_TONG_HOP');
    await expect(page.locator('#qtKnLinhVuc input[type="checkbox"]')).toHaveCount(4);
    await expect(page.locator('#qtKnLinhVuc')).toContainText('Tài chính');
    await page.locator('#qtKiemNhiemModal button[data-action="dongKiemNhiem"]').click();
    await expect(page.locator('#qtKiemNhiemModal')).toBeHidden();

    // Về mục theo vai trò: section vai trò hiện lại, mục Quản trị ẩn.
    await page.locator('#navKl').click();
    await expect(page.locator('#viewKl')).toBeVisible();
    await expect(page.locator('#viewQuanTri')).toBeHidden();
    await page.context().close();
  });
});
