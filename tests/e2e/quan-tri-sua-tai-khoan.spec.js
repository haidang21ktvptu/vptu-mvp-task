// PR-4 (0068 admin_sua_tai_khoan): quản trị hệ thống bấm "Sửa" ở bảng Tài khoản và cờ → đổi phòng + chức danh của demo_e2e_dh (lý do bắt buộc,
// không đổi gì thì không lưu) → bảng và nhật ký cấp quyền cập nhật (cũ → mới); hộp đổi ô Phòng theo vai (A0 ẩn, A1 khoá "Lãnh đạo Văn phòng");
// đổi sang Trưởng phòng ở phòng đã có A2 ⇒ hộp hiện đúng lỗi của DB; trả lại như cũ trong chính spec. Một phiên demo_qtht, chỉ máy tính.
// Khôi phục giá trị gốc ghi cứng ở cả beforeAll lẫn afterAll (service_role) để lỗi giữa chừng không để tài khoản seed ở trạng thái sai.
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { contextAs, nav, NAP } from './lib/app.js';
import { OPTIONAL_USERS, storageStatePath } from './lib/roles.mjs';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';

const DH_ID = '00000000-0000-4000-8000-000000000013'; // demo_e2e_dh (seed.sql)
const GOC = { role_group: 'A3', department: 'TONG_HOP', position_title: 'Chuyên viên' };
const CHUC_DANH_MOI = 'Chuyên viên E2E PR4';

function dbAdmin() {
  const k = getKeys();
  return createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
}
const khoiPhuc = async () => { const r = await dbAdmin().from('accounts').update(GOC).eq('id', DH_ID); if (r.error) throw new Error(r.error.message); };

test.describe.serial('Quản trị: sửa vai trò / phòng / chức danh tài khoản (PR-4)', () => {
  test.beforeAll(async () => {
    if (existsSync(storageStatePath('QTHT'))) await khoiPhuc();
  });
  test.afterAll(async () => {
    if (existsSync(storageStatePath('QTHT'))) await khoiPhuc();
  });

  test('QTHT sửa phòng + chức danh demo_e2e_dh, lỗi A2 trùng phòng, trả lại như cũ', async ({ browser }, testInfo) => {
    test.skip(!existsSync(storageStatePath('QTHT')), 'Chưa có demo_qtht trên project này.');
    const context = await contextAs(browser, 'QTHT', testInfo);
    const page = await context.newPage();
    await page.goto('./');
    await expect(page.locator('#currentUserDisplay')).toContainText(OPTIONAL_USERS.QTHT.fullName);
    await nav(page, 'navQuanTri');
    await page.locator('#qtTabTaiKhoan').click();
    const row = page.locator('#qtTaiKhoanBody tr', { hasText: 'demo_e2e_dh' });
    await expect(row).toContainText('Phòng Tổng hợp', NAP);
    const modal = page.locator('#qtSuaTkModal');
    const loi = page.locator('#qtSuaTkError');
    const moSua = async () => {
      await row.locator('button[data-action="moSuaTaiKhoan"]').click();
      await expect(modal).toBeVisible();
      await expect(page.locator('#qtSuaTkMoTa')).toContainText('demo_e2e_dh');
    };
    const luu = () => page.locator('#qtSuaTkLuu').click();

    // 1. Mở hộp: giá trị hiện tại; không đổi gì ⇒ không lưu; thiếu lý do ⇒ không lưu.
    await moSua();
    await expect(page.locator('#qtSuaTkVai')).toHaveValue('A3');
    await expect(page.locator('#qtSuaTkPhong')).toHaveValue('TONG_HOP');
    await expect(page.locator('#qtSuaTkChucDanh')).toHaveValue('Chuyên viên');
    await luu();
    await expect(loi).toContainText('Không có thay đổi nào');
    await page.locator('#qtSuaTkPhong').selectOption('QUAN_TRI');
    await page.locator('#qtSuaTkChucDanh').fill(CHUC_DANH_MOI);
    await luu();
    await expect(loi).toContainText('Phải ghi lý do');
    const lyDo = `${E2E_TAG} ${testInfo.project.name} ${Date.now()}`;
    await page.locator('#qtSuaTkLyDo').fill(lyDo);
    await luu();
    await expect(modal).toBeHidden(NAP);
    await expect(page.locator('#toastContainer')).toContainText('Đã sửa tài khoản Demo E2E Chuyên viên DH');
    await expect(row).toContainText('Phòng Quản trị', NAP);
    await expect(row).toContainText(CHUC_DANH_MOI);

    // 2. Nhật ký cấp quyền: hai dòng sửa (phòng, chức danh) cũ → mới, cùng lý do.
    await page.locator('#qtTabNhatKy').click();
    const nhatKy = page.locator('#qtNhatKyBody tr', { hasText: lyDo });
    await expect(nhatKy).toHaveCount(2, NAP);
    await expect(nhatKy.filter({ hasText: 'Sửa phòng: Phòng Tổng hợp → Phòng Quản trị' })).toHaveCount(1);
    await expect(nhatKy.filter({ hasText: `Sửa chức danh: Chuyên viên → ${CHUC_DANH_MOI}` })).toHaveCount(1);

    // 3. Ô Phòng theo vai; sang Trưởng phòng ở phòng đã có A2 ⇒ lỗi nguyên văn của DB, hộp vẫn mở, không ghi gì.
    await page.locator('#qtTabTaiKhoan').click();
    await moSua();
    await page.locator('#qtSuaTkVai').selectOption('A0');
    await expect(page.locator('#qtSuaTkPhongWrap')).toBeHidden();
    await page.locator('#qtSuaTkVai').selectOption('A1');
    await expect(page.locator('#qtSuaTkPhong')).toBeDisabled();
    await expect(page.locator('#qtSuaTkPhong')).toHaveValue('LANH_DAO_VAN_PHONG');
    await page.locator('#qtSuaTkVai').selectOption('A2');
    await page.locator('#qtSuaTkPhong').selectOption('TONG_HOP');
    await page.locator('#qtSuaTkLyDo').fill(`${lyDo} A2`);
    await luu();
    await expect(loi).toContainText(/Phòng Tổng hợp đã có Trưởng phòng \(A2\) đang hoạt động: .+ Mỗi phòng một Trưởng phòng/, NAP);
    await expect(modal).toBeVisible();
    await page.locator('#qtSuaTkModal button[data-action="dongSuaTaiKhoan"]').click();
    await expect(modal).toBeHidden();

    // 4. Trả lại như cũ qua chính hộp Sửa.
    await moSua();
    await page.locator('#qtSuaTkPhong').selectOption('TONG_HOP');
    await page.locator('#qtSuaTkChucDanh').fill(GOC.position_title);
    await page.locator('#qtSuaTkLyDo').fill(`${lyDo} trả lại`);
    await luu();
    await expect(modal).toBeHidden(NAP);
    await expect(row).toContainText('Phòng Tổng hợp', NAP);
    const { data } = await dbAdmin().from('accounts').select('role_group, department, position_title').eq('id', DH_ID).single();
    expect(data).toEqual(GOC);
    await context.close();
  });
});
