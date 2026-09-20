// Kịch bản 7 (MSG-2; giao diện v7 GĐ20): hai phiên song song — A2 mở màn hình Nhắn tin, chọn cán bộ ở danh bạ, nhắn tin riêng; A3 nhận realtime
// (toast, huy hiệu ở mục menu) và mở hội thoại từ toast. Cặp tài khoản riêng phòng E2E_RT.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs, nav } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { USERS } from './lib/roles.mjs';

const E2E_CV_ID = '00000000-0000-4000-8000-000000000016'; // demo_e2e_cv — neo danh bạ theo id (không lọc theo tên: tên có thể là tiền tố của tài khoản khác)

const CV1_ID = '00000000-0000-4000-8000-000000000016';         // demo_e2e_cv
const TRUONGPHONG_ID = '00000000-0000-4000-8000-000000000015'; // demo_e2e_tp
const RT = { timeout: 20_000 }; // realtime trên gói Free có thể trễ vài giây

test.describe.serial('Realtime nhắn tin 1-1', () => {
  let a3Page;
  let a2Page;

  test.beforeAll(async ({ browser }, testInfo) => {
    const k = getKeys();
    const db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    // Xoá tin nhắn cũ giữa hai tài khoản giả để huy hiệu chưa đọc bắt đầu từ 0.
    await db.from('direct_messages').delete()
      .or(`and(sender_id.eq.${TRUONGPHONG_ID},receiver_id.eq.${CV1_ID}),and(sender_id.eq.${CV1_ID},receiver_id.eq.${TRUONGPHONG_ID})`);
    a3Page = await pageAs(browser, 'E2E_CV', testInfo);
    a2Page = await pageAs(browser, 'E2E_TP', testInfo);
  });

  test.afterAll(async () => {
    for (const p of [a3Page, a2Page]) await p?.context().close();
  });

  test('A2 nhắn tin riêng → A3 nhận toast + huy hiệu, mở hội thoại từ toast', async () => {
    await expect(a3Page.locator('#dmBubbleBadge')).toBeHidden();

    await nav(a2Page, 'dmBubbleLauncher');
    await expect(a2Page.locator('#viewNhanTin')).toBeVisible();
    // Tài khoản hệ thống (is_system) không có trong danh bạ.
    await expect(a2Page.locator('#dmContactList')).not.toContainText('Tài khoản kiểm thử hệ thống');
    await a2Page.locator(`#dmContactList [data-action=openDMChat][data-peer-id="${E2E_CV_ID}"]`).click();
    await expect(a2Page.locator('#dmChatHeaderName')).toHaveText(USERS.E2E_CV.fullName);
    await a2Page.locator('#dmInput').fill('Đồng chí lên phòng gặp tôi (e2e)');
    await a2Page.locator('#dmInput').press('Enter');
    await expect(a2Page.locator('#dmChatBox')).toContainText('Đồng chí lên phòng gặp tôi (e2e)');

    // A3: toast + huy hiệu tổng chưa đọc (MSG-2) ở mục menu Nhắn tin.
    await expect(a3Page.locator('#realtimeToast')).toBeVisible(RT);
    await expect(a3Page.locator('#toastSender')).toContainText('Demo E2E Trưởng phòng RT');
    await expect(a3Page.locator('#toastContent')).toContainText('Đồng chí lên phòng gặp tôi (e2e)');
    await expect(a3Page.locator('#dmBubbleBadge')).toHaveText('1');

    await a3Page.locator('#toastActionBtn').click();
    await expect(a3Page.locator('#viewNhanTin')).toBeVisible();
    await expect(a3Page.locator('#dmChatHeaderName')).toHaveText('Demo E2E Trưởng phòng RT');
    await expect(a3Page.locator('#dmChatBox')).toContainText('Đồng chí lên phòng gặp tôi (e2e)');
    await expect(a3Page.locator('#dmBubbleBadge')).toBeHidden();
  });
});
