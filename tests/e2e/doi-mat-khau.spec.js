// GĐ23 — đổi mật khẩu lần đầu (AUTH-2, 0041) và chuông: tạo tài khoản tạm bằng service_role (auth user + accounts is_system, must_change_password)
// kèm 1 tin hệ thống chưa đọc → đăng nhập qua form → bị chặn ở trang "Đặt mật khẩu mới" (dải ẩn) → mật khẩu yếu / trùng tạm bị từ chối → đổi
// đúng → vào app, huy hiệu chuông = 1, dải có Tìm · Chuông · avatar · bánh răng, không còn nút Đăng xuất lớn → đăng xuất qua bánh răng. Tự dọn.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { getKeys, EMAIL_DOMAIN } from './lib/keys.mjs';

const USERNAME = 'e2e_doi_mk';
const MK_TAM = 'Tam123456';
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
let admin; let userId;

test.describe.serial('Đặt mật khẩu mới lần đầu', () => {
  test.beforeAll(async () => {
    const k = getKeys();
    admin = createClient(k.url, k.service, noSession);
    const cu = await admin.from('accounts').select('id').eq('username', USERNAME).maybeSingle();
    if (cu.data) { await admin.from('accounts').delete().eq('id', cu.data.id); await admin.auth.admin.deleteUser(cu.data.id); }
    const { data, error } = await admin.auth.admin.createUser({ email: `${USERNAME}@${EMAIL_DOMAIN}`, password: MK_TAM, email_confirm: true });
    if (error) throw new Error(`Tạo auth user thất bại: ${error.message}`);
    userId = data.user.id;
    const acc = await admin.from('accounts').insert({ id: userId, username: USERNAME, full_name: 'E2E Đổi Mật Khẩu', role_group: 'A3', position_title: 'Chuyên viên',
      department: 'CDS_CY', is_system: true, must_change_password: true });
    if (acc.error) throw new Error(`Tạo accounts thất bại: ${acc.error.message}`);
    const tin = await admin.from('direct_messages').insert({ sender_id: null, receiver_id: userId, content: 'E2E-TEST · NV-T000: thông báo thử chuông', is_read: false, loai: 'he_thong' });
    if (tin.error) throw new Error(`Tạo tin hệ thống thất bại: ${tin.error.message}`);
  });

  test.afterAll(async () => {
    if (!userId) return;
    await admin.from('direct_messages').delete().eq('receiver_id', userId);
    await admin.from('accounts').delete().eq('id', userId);
    await admin.auth.admin.deleteUser(userId);
  });

  test('bị chặn ở trang đặt mật khẩu → đổi đúng → vào app, chuông hiện 1, đăng xuất qua bánh răng', async ({ page }) => {
    await page.goto('./');
    await page.locator('#loginUsername').fill(USERNAME);
    await page.locator('#loginPassword').fill(MK_TAM);
    await page.locator('#loginSubmitBtn').click();

    const trang = page.locator('#changePasswordModal');
    await expect(trang).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#mainHeader')).toBeHidden();
    await expect(page.locator('#changePasswordHuy')).toBeHidden(); // bắt buộc: không có Quay lại
    await page.reload(); // tải lại vẫn bị chặn (cờ ở DB)
    await expect(trang).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#mainHeader')).toBeHidden();

    await page.locator('#newPassword').fill('abcdefgh'); await page.locator('#newPasswordConfirm').fill('abcdefgh');
    await page.locator('#changePasswordBtn').click();
    await expect(page.locator('#changePasswordError')).toContainText('tối thiểu 8 ký tự');
    // Sau tải lại không còn mật khẩu tạm trong bộ nhớ → chặn trùng do máy chủ (same_password) hoặc do app khi chưa tải lại; cả hai đều tiếng Việt.
    await page.locator('#newPassword').fill(MK_TAM); await page.locator('#newPasswordConfirm').fill(MK_TAM);
    await page.locator('#changePasswordBtn').click();
    await expect(page.locator('#changePasswordError')).toContainText(/khác mật khẩu/);

    const MK_MOI = `Moi${Date.now()}`;
    await page.locator('#newPassword').fill(MK_MOI); await page.locator('#newPasswordConfirm').fill(MK_MOI);
    await page.locator('#changePasswordBtn').click();
    await expect(page.locator('#mainHeader')).toBeVisible({ timeout: 20_000 });
    await expect(trang).toBeHidden();
    await expect(page.locator('#currentUserDisplay')).toContainText('E2E Đổi Mật Khẩu');
    await expect(page.locator('#currentRoleDisplay')).toHaveText('Chuyên viên · Phòng Chuyển đổi số - Cơ yếu');
    await expect(page.locator('#avatarNguoi')).toHaveText('K');
    // Cụm phải đúng thứ tự: Tìm → Chuông → avatar → Bánh răng; không còn nút Đăng xuất lớn trên dải.
    const cum = page.locator('#mainHeader .phai');
    await expect(cum.locator('#timNhanhBtn')).toBeVisible();
    await expect(cum.locator('#chuongBtn')).toBeVisible();
    await expect(cum.locator('#banhRangBtn')).toBeVisible();
    expect(await cum.locator('.tim-nhanh + .chuong + .nguoi + .banh-rang').count()).toBe(1);
    await expect(page.locator('#mainHeader .nut-thoat')).toHaveCount(0);
    await expect(page.locator('#chuongBadge')).toHaveText('1');
    const badge = await page.locator('#chuongBadge').evaluate((el) => globalThis.getComputedStyle(el).backgroundColor);
    expect(badge).toBe('rgb(229, 57, 53)'); // huy hiệu đỏ
    const co = await admin.from('accounts').select('must_change_password').eq('id', userId).single();
    expect(co.data.must_change_password).toBe(false);

    // Chuông: mở bảng, "Đánh dấu đã đọc" → huy hiệu ẩn.
    await page.locator('#chuongBtn').click();
    await expect(page.locator('#thongBaoList')).toContainText('NV-T000');
    await page.locator('#thongBaoDocHet').click();
    await expect(page.locator('#chuongBadge')).toBeHidden();

    await page.locator('#banhRangBtn').click();
    await expect(page.locator('#banhRangMenu [role="menuitem"]').last()).toHaveText('Đăng xuất');
    await page.locator('#logoutBtn').click();
    await expect(page.locator('#loginSection')).toBeVisible();
  });
});
