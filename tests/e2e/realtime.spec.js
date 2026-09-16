// Kịch bản 7 (MSG-2): hai phiên song song — A2 nhắn tin riêng, A3 nhận realtime (toast, huy hiệu) và mở hội thoại.
// Case "A2 gửi ý kiến chỉ đạo theo tasks" bỏ ở GĐ14 (luồng ý kiến theo bảng tasks bỏ; chỉ đạo theo nhiệm vụ là GĐ18).
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';

const CV1_ID = '00000000-0000-4000-8000-000000000016';         // demo_e2e_cv — cặp tài khoản riêng phòng E2E_RT (GĐ18)
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

    // Hai phiên sẵn A3 và A2 (storageState), không tốn lượt đăng nhập.
    a3Page = await pageAs(browser, 'E2E_CV', testInfo);
    a2Page = await pageAs(browser, 'E2E_TP', testInfo);
  });

  test.afterAll(async () => {
    for (const p of [a3Page, a2Page]) await p?.context().close();
  });

  test('A2 nhắn tin riêng → A3 nhận toast + huy hiệu, mở hội thoại từ toast', async () => {
    await expect(a3Page.locator('#dmBubbleBadge')).toBeHidden();

    await a2Page.locator('#dmBubbleLauncher').click();
    // Tài khoản hệ thống (is_system) không có trong danh bạ.
    await expect(a2Page.locator('#dmContactList')).not.toContainText('Tài khoản kiểm thử hệ thống');
    await a2Page.locator('#dmContactList [data-action=openDMChat]', { hasText: 'Demo E2E Chuyên viên RT' }).click();
    await a2Page.locator('#dmInput').fill('Đồng chí lên phòng gặp tôi (e2e)');
    await a2Page.locator('#dmInput').press('Enter');
    await expect(a2Page.locator('#dmChatBox')).toContainText('Đồng chí lên phòng gặp tôi (e2e)');

    // A3: toast + huy hiệu tổng chưa đọc (MSG-2).
    await expect(a3Page.locator('#realtimeToast')).toBeVisible(RT);
    await expect(a3Page.locator('#toastSender')).toContainText('Demo E2E Trưởng phòng RT');
    await expect(a3Page.locator('#toastContent')).toContainText('Đồng chí lên phòng gặp tôi (e2e)');
    await expect(a3Page.locator('#dmBubbleBadge')).toHaveText('1');

    await a3Page.locator('#toastActionBtn').click();
    await expect(a3Page.locator('#dmModal')).toBeVisible();
    await expect(a3Page.locator('#dmChatHeaderName')).toHaveText('Demo E2E Trưởng phòng RT');
    await expect(a3Page.locator('#dmChatBox')).toContainText('Đồng chí lên phòng gặp tôi (e2e)');
    await expect(a3Page.locator('#dmBubbleBadge')).toBeHidden();
  });
});
