// Kịch bản 7 (bổ sung, DIR-4 + MSG-2): hai phiên song song — A2 gửi ý kiến chỉ đạo và tin nhắn
// riêng, A3 nhận realtime (huy hiệu chưa đọc, viền dòng nhiệm vụ, toast tin nhắn) rồi trả lời.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loginAs, logout, openA2TrackingTab } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';

const CV1_ID = '00000000-0000-4000-8000-000000000004';
const TRUONGPHONG_ID = '00000000-0000-4000-8000-000000000003';
const RT = { timeout: 20_000 }; // realtime trên gói Free có thể trễ vài giây

test.describe.serial('Realtime ý kiến chỉ đạo và nhắn tin 1-1', () => {
  let taskId;
  let a3Page;
  let a2Page;

  test.beforeAll(async ({ browser }, testInfo) => {
    // Nhiệm vụ đang thực hiện của demo_cv1 (tạo bằng service_role, dọn bởi global-setup lần sau).
    const k = getKeys();
    const db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await db.from('tasks').insert({
      title: `${E2E_TAG} realtime ${testInfo.project.name} ${Date.now()}`,
      resolution_code: 'NQ 57-NQ/TW', expected_product: 'Kế hoạch (e2e)',
      deadline: new Date(Date.now() + 5 * 86400000).toISOString(), critical_overdue_days: 3,
      competent_authority: 'Lãnh đạo Văn phòng', status: 'DANG_THUC_HIEN',
      assigned_to: CV1_ID, leader_in_charge: TRUONGPHONG_ID, created_by: TRUONGPHONG_ID, warning_count: 0,
    }).select('id').single();
    if (error) throw new Error(`Tạo nhiệm vụ mẫu thất bại: ${error.message}`);
    taskId = data.id;
    // Xoá tin nhắn cũ giữa hai tài khoản giả để huy hiệu chưa đọc bắt đầu từ 0.
    await db.from('direct_messages').delete()
      .or(`and(sender_id.eq.${TRUONGPHONG_ID},receiver_id.eq.${CV1_ID}),and(sender_id.eq.${CV1_ID},receiver_id.eq.${TRUONGPHONG_ID})`);

    const { viewport, isMobile, hasTouch, baseURL, locale } = testInfo.project.use;
    const ctxOptions = { viewport, isMobile, hasTouch, baseURL, locale };
    a3Page = await (await browser.newContext(ctxOptions)).newPage();
    a2Page = await (await browser.newContext(ctxOptions)).newPage();
    await loginAs(a3Page, 'A3');
    await loginAs(a2Page, 'A2');
  });

  test.afterAll(async () => {
    for (const p of [a3Page, a2Page]) {
      if (!p) continue;
      await logout(p).catch(() => {});
      await p.context().close();
    }
  });

  test('A2 gửi ý kiến → A3 thấy huy hiệu chưa đọc, mở luồng và phản hồi được', async () => {
    await expect(a3Page.locator(`#taskRow-${taskId}`)).toBeVisible();
    const badge = a3Page.locator(`#directiveBadge-${taskId}`);
    await expect(badge).toBeHidden();

    await openA2TrackingTab(a2Page);
    await a2Page.locator(`#taskRow-${taskId}`).getByRole('button', { name: 'Ý kiến' }).click();
    await a2Page.locator(`#directiveInput-${taskId}`).fill('Đề nghị báo cáo tiến độ trước thứ Sáu (e2e)');
    await a2Page.locator(`#directiveInput-${taskId}`).press('Enter');
    await expect(a2Page.locator(`#directiveFeed-${taskId}`)).toContainText('Đề nghị báo cáo tiến độ trước thứ Sáu (e2e)');

    // A3 nhận realtime: huy hiệu = 1, dòng nhiệm vụ được viền nổi bật (DIR-4).
    await expect(badge).toBeVisible(RT);
    await expect(badge).toHaveText('1');
    await expect(a3Page.locator(`#taskRow-${taskId}`)).toHaveClass(/ring-2/);

    // A3 mở luồng: đọc ý kiến, huy hiệu về 0, được phép phản hồi vì đã có ý kiến của Lãnh đạo (DIR-2).
    await a3Page.locator(`#taskRow-${taskId}`).getByRole('button', { name: 'Ý kiến' }).click();
    await expect(a3Page.locator(`#directiveFeed-${taskId}`)).toContainText('Đề nghị báo cáo tiến độ trước thứ Sáu (e2e)');
    await expect(badge).toBeHidden();
    await expect(a3Page.locator(`#directiveWarn-${taskId}`)).toBeHidden();
    await a3Page.locator(`#directiveInput-${taskId}`).fill('Đã nhận, sẽ báo cáo đúng hạn (e2e)');
    await a3Page.locator(`#directiveInput-${taskId}`).press('Enter');

    // A2 đang mở luồng nên nhận phản hồi ngay.
    await expect(a2Page.locator(`#directiveFeed-${taskId}`)).toContainText('Đã nhận, sẽ báo cáo đúng hạn (e2e)', RT);
  });

  test('A2 nhắn tin riêng → A3 nhận toast + huy hiệu, mở hội thoại từ toast', async () => {
    await expect(a3Page.locator('#dmBubbleBadge')).toBeHidden();

    await a2Page.locator('#dmBubbleLauncher').click();
    await a2Page.locator('#dmContactList [data-action=openDMChat]', { hasText: 'Demo Chuyên viên Một' }).click();
    await a2Page.locator('#dmInput').fill('Đồng chí lên phòng gặp tôi (e2e)');
    await a2Page.locator('#dmInput').press('Enter');
    await expect(a2Page.locator('#dmChatBox')).toContainText('Đồng chí lên phòng gặp tôi (e2e)');

    // A3: toast + huy hiệu tổng chưa đọc (MSG-2).
    await expect(a3Page.locator('#realtimeToast')).toBeVisible(RT);
    await expect(a3Page.locator('#toastSender')).toContainText('Demo Trưởng phòng');
    await expect(a3Page.locator('#toastContent')).toContainText('Đồng chí lên phòng gặp tôi (e2e)');
    await expect(a3Page.locator('#dmBubbleBadge')).toHaveText('1');

    await a3Page.locator('#toastActionBtn').click();
    await expect(a3Page.locator('#dmModal')).toBeVisible();
    await expect(a3Page.locator('#dmChatHeaderName')).toHaveText('Demo Trưởng phòng');
    await expect(a3Page.locator('#dmChatBox')).toContainText('Đồng chí lên phòng gặp tôi (e2e)');
    await expect(a3Page.locator('#dmBubbleBadge')).toBeHidden();
  });
});
