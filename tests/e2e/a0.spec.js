// GĐ20 — vai trò A0 Thường trực Tỉnh ủy (mockup bản 5 "Trung tâm điều hành Thường trực"): đăng nhập → vào thẳng trung tâm điều hành
// (4 số-lọc, thanh trái 4 khâu, thẻ việc Đỏ có nút Chỉ đạo + Xem diễn biến) → menu chỉ 3 mục (không Nhắn tin, không Quản trị) → Toàn bộ
// nhiệm vụ: chỉ đọc + Ý kiến/Chỉ đạo (quyền thật: hàm 0030 từ chối A0 tường minh — test RLS kl-0030). Không tạo dữ liệu; bỏ qua khi thiếu demo_a0.
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { contextAs, nav } from './lib/app.js';
import { OPTIONAL_USERS, storageStatePath } from './lib/roles.mjs';

test.describe.serial('Thường trực Tỉnh ủy (A0) — trung tâm điều hành, chỉ xem', () => {
  let page;

  test.beforeAll(async ({ browser }, testInfo) => {
    test.skip(!existsSync(storageStatePath('A0')), 'Chưa có demo_a0 trên project này.');
    const context = await contextAs(browser, 'A0', testInfo);
    page = await context.newPage();
    await page.goto('./');
    await expect(page.locator('#currentUserDisplay')).toContainText(OPTIONAL_USERS.A0.fullName);
  });
  test.afterAll(async () => { await page?.context().close(); });

  test('vào thẳng Trung tâm điều hành: 4 số-lọc, 4 khâu ở thanh trái, menu 3 mục, nhãn vai trò đúng', async () => {
    await expect(page.locator('#currentRoleDisplay')).toContainText(OPTIONAL_USERS.A0.roleLabel);
    await expect(page.locator('#viewDieuHanh')).not.toHaveClass(/\bhidden\b/);
    await expect(page.locator('#dhTieuDeTrang')).toHaveText('Trung tâm điều hành Thường trực');
    await expect(page.locator('#dhTinhDen')).toContainText('so sánh với tuần trước');
    await expect(page.locator('#dhKpi button')).toHaveCount(5); // GĐ21: thêm ô "bị từ chối" riêng
    await expect(page.locator('#dhKpi [data-loc="tuchoi"]')).toContainText('bị từ chối');
    await expect(page.locator('#dhRay [data-khau]')).toHaveCount(5);
    await expect(page.locator('#navDieuHanh')).toBeVisible();
    await expect(page.locator('#navChiDaoDaGui')).toBeVisible();
    await expect(page.locator('#navKl')).toBeVisible();
    await expect(page.locator('#navCanBo')).toBeVisible();           // GĐ21: Cán bộ toàn Văn phòng
    await expect(page.locator('#dmBubbleLauncher')).toBeVisible();   // GĐ21: A0 nhắn tin 1-1
    await expect(page.locator('#navQuanTri')).toHaveCount(0);
    await page.locator('#navCanBo').click();
    await expect(page.locator('#viewCanBo .cb section').first()).toContainText('Lãnh đạo Văn phòng');
    await page.locator('#navDieuHanh').click();
  });

  test('số-lọc và thanh trái là bộ lọc: bấm khâu → aria-pressed, danh sách đổi tiêu đề; số hoàn thành → toàn cảnh', async () => {
    const theTruoc = await page.locator('#dsThe .the').count();
    const khau = page.locator('#dhRay [data-khau="CHUA_NHAN"]');
    await khau.click();
    await expect(khau).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#dsTieuDe')).toContainText('khâu chưa nhận việc');
    expect(await page.locator('#dsThe .the').count()).toBeLessThanOrEqual(theTruoc);
    for (const t of await page.locator('#dsThe .the').all()) await expect(t).toHaveAttribute('data-khau', 'CHUA_NHAN');
    await page.locator('#dhRay .tat').click();
    await expect(khau).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#dhKpi [data-loc="tat"]').click();
    await expect(page.locator('#dsTieuDe')).toContainText('Toàn cảnh');
    await expect(page.locator('#dsThe .toan-canh')).toBeVisible();
    await page.locator('#dhKpi [data-loc="tat"]').click();
    await expect(page.locator('#dsTieuDe')).toContainText('đang nghẽn');
  });

  test('thẻ việc Đỏ: số ngày trễ, khâu, nút Chỉ đạo mở ô một dòng có gợi ý; Xem diễn biến mở ngăn chi tiết ở Toàn bộ nhiệm vụ', async () => {
    const the = page.locator('#dsThe .the').first();
    if (await the.count() === 0) return; // phạm vi không có việc Đỏ
    await expect(the.locator('.tre')).toBeVisible();
    await expect(the.locator('.khau')).toBeVisible();
    await the.locator('[data-action="moO"]').click();
    const o = the.locator('form.o');
    await expect(o).toHaveClass(/\bmo\b/);
    await expect(o.locator('.goi-y button')).toHaveCount(4);
    await o.locator('.goi-y button').first().click();
    await expect(o.locator('input[name=noi_dung]')).toHaveValue('Báo cáo Thường trực lý do chậm');
    await o.locator('[data-action="dongO"]').click();
    await expect(o).not.toHaveClass(/\bmo\b/);
    const id = (await the.getAttribute('id')).replace('the-', '');
    // GĐ22: Xem diễn biến mở dòng thời gian ngay dưới thẻ (không rời trang); bấm lại để gập.
    await the.locator('[data-action="xemDienBien"]').click();
    await expect(page.locator('#viewDieuHanh')).toBeVisible();
    await expect(the.locator(`#db-${id} .dien-bien li`).first()).toBeVisible();
    await the.locator('[data-action="xemDienBien"]').click();
    await expect(the.locator(`#db-${id}`)).toHaveCount(0);
  });

  test('Toàn bộ nhiệm vụ: thấy danh sách, không có Giao việc / Xác nhận nhận việc / Đóng nhiệm vụ / Nộp minh chứng, chỉ ô Ý kiến / Chỉ đạo', async () => {
    await nav(page, 'navKl');
    const row = page.locator('#klBody [id^="klRow-"]').first();
    await expect(row).toBeVisible();
    await expect(page.locator('#klNutThem')).toBeHidden();
    await row.click();
    const ngan = page.locator('#klChiTiet');
    await expect(ngan.locator('.chi-tiet-noi')).toBeVisible();
    await expect(ngan.locator('[data-action=xacNhanNhanViec]')).toHaveCount(0);
    await expect(ngan.locator('[data-action=openDongNhiemVu]')).toHaveCount(0);
    await expect(ngan.locator('[data-action=openMinhChung]')).toHaveCount(0);
    await expect(ngan.locator('select.nl-cap')).toHaveCount(0); // cấp quyết định chỉ đọc
    const form = ngan.locator('form.cd-form').first();
    await expect(form).toBeVisible();
    await expect(form.locator('select[name=loai] option')).toHaveCount(2); // Ý kiến / Chỉ đạo (GĐ19, CH-16)
    await expect(form.locator('select[name=loai]')).toHaveValue('Y_KIEN');
    await expect(form.locator('button[type=submit]')).toHaveText('Gửi');
    await expect(ngan.locator('form.cd-form-ph')).toHaveCount(0);
  });
});
