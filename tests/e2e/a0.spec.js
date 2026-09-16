// GĐ18 — vai trò A0 Thường trực Tỉnh ủy (CH-11 = A, SPEC CB-5): đăng nhập → vào thẳng Dashboard (lọc sẵn Đỏ đặc biệt, mở rộng
// được sang mọi việc Đỏ) → không có nút ghi nào ngoài "Ý kiến" (quyền thật: hàm 0030 từ chối A0 tường minh — test RLS kl-0030).
// Không tạo dữ liệu; bỏ qua khi project chưa có demo_a0 (migration 0030 + seed).
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { contextAs } from './lib/app.js';
import { OPTIONAL_USERS, storageStatePath } from './lib/roles.mjs';

test.describe.serial('Thường trực Tỉnh ủy (A0) — chỉ xem', () => {
  let page;

  test.beforeAll(async ({ browser }, testInfo) => {
    test.skip(!existsSync(storageStatePath('A0')), 'Chưa có demo_a0 trên project này.');
    const context = await contextAs(browser, 'A0', testInfo);
    page = await context.newPage();
    await page.goto('./');
    await expect(page.locator('#currentUserDisplay')).toContainText(OPTIONAL_USERS.A0.fullName);
  });
  test.afterAll(async () => { await page?.context().close(); });

  test('vào thẳng Dashboard; thanh bên chỉ Dashboard + Nhiệm vụ + Nhắn tin; nhãn vai trò đúng', async () => {
    await expect(page.locator('#currentRoleDisplay')).toHaveText(OPTIONAL_USERS.A0.roleLabel);
    await expect(page.locator('#viewKlDashboard')).not.toHaveClass(/\bhidden\b/);
    await expect(page.locator('#klDbTinhDen')).toContainText('Số liệu tính đến');
    await expect(page.locator('#navKlDashboard')).toBeVisible();
    await expect(page.locator('#navKl')).toBeVisible();
    await expect(page.locator('#tabBtnA1Staffs')).toHaveCount(0);
    await expect(page.locator('#navQuanTri')).toHaveCount(0);
  });

  test('bảng ngoại lệ: không nút Chỉ đạo, cấp quyết định chỉ đọc, chỉ dòng Đỏ đặc biệt cho tới khi bấm mở rộng', async () => {
    await expect(page.locator('#klDbNgoaiLe button', { hasText: 'Chỉ đạo' })).toHaveCount(0);
    await expect(page.locator('#klDbNgoaiLe select.nl-cap')).toHaveCount(0);
    const rows = page.locator('#klDbNgoaiLeBody tr[id^="nlRow-"]');
    if (await rows.count() > 0) {
      for (const r of await rows.all()) await expect(r).toHaveAttribute('data-muc', 'DO_DAC_BIET');
      await expect(page.locator('#nlLocA0')).toHaveText('Xem mọi việc Đỏ');
      await page.locator('#nlLocA0').click();
      await expect(page.locator('#nlLocA0')).toHaveText('Chỉ Đỏ đặc biệt');
      expect(await page.locator('#klDbNgoaiLeBody tr[id^="nlRow-"]').count()).toBeGreaterThanOrEqual(await rows.count());
    }
  });

  test('màn hình Nhiệm vụ: thấy danh sách, không có Giao việc / Xác nhận nhận việc / Đóng nhiệm vụ / Nộp minh chứng, chỉ nút Ý kiến', async () => {
    await page.locator('#navKl').click();
    await expect(page.locator('#klBody tr[id^="klRow-"]').first()).toBeVisible();
    await expect(page.locator('#klNutThem')).toBeHidden();
    await expect(page.locator('#klBody [data-action=xacNhanNhanViec]')).toHaveCount(0);
    await expect(page.locator('#klBody [data-action=openDongNhiemVu]')).toHaveCount(0);
    await expect(page.locator('#klBody [data-action=openMinhChung]')).toHaveCount(0);
    const yKien = page.locator('#klBody [data-action=moKlChiDao]').first();
    await expect(yKien).toHaveText('Ý kiến');
    await yKien.click();
    const form = page.locator('#klBody form.cd-form').first();
    await expect(form).toBeVisible();
    await expect(form.locator('select[name=loai] option')).toHaveCount(1);
    await expect(form.locator('select[name=loai]')).toHaveValue('Y_KIEN');
    await expect(form.locator('button[type=submit]')).toHaveText('Gửi ý kiến');
    await expect(page.locator('#klBody [data-action=dongChiDao]')).toHaveCount(0);
    await expect(page.locator('#klBody form.cd-form-ph')).toHaveCount(0);
  });
});
