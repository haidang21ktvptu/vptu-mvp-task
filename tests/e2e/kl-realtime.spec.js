// Kịch bản 11 (GĐ10 PR 10D): thời gian thực module KL — A1 mở danh sách, dữ liệu đổi ở DB (service_role, như chuyên viên
// cập nhật ở máy khác) → ô số và dòng tự đổi, không bấm gì; mất mạng → chỉ báo chuyển sang "làm mới mỗi 60 giây",
// có mạng lại → "Cập nhật trực tiếp". GĐ15: app nghe sự kiện offline/online của trình duyệt nên đổi chế độ trong vài giây,
// không chờ heartbeat socket. Nhiệm vụ mẫu ở hội nghị 996 (E2E), tự dọn.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';

const CV1_ID = '00000000-0000-4000-8000-000000000014'; // demo_e2e_owner — chỉ làm Owner dữ liệu (GĐ18)
const SO_HOI_NGHI = 996;
const RT = { timeout: 20_000 };   // realtime trên gói Free có thể trễ vài giây
const KN = { timeout: 5_000 };    // mất mạng → dự phòng ngay theo sự kiện offline (GĐ15), không chờ heartbeat

test.describe.serial('Kết luận BTVTU — thời gian thực', () => {
  let db; let hnId; let page;

  test.beforeAll(async ({ browser }, testInfo) => {
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('nhiem_vu').select('id').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có module KL (0014+).');
    await don(db);
    const { data: hn, error } = await db.from('van_ban_giao_viec').insert({ so_hoi_nghi: SO_HOI_NGHI, so_ket_luan: `${E2E_TAG}-RT`, ngay_ban_hanh: '2026-08-01' }).select('id').single();
    if (error) throw new Error(`Tạo hội nghị mẫu thất bại: ${error.message}`);
    hnId = hn.id;
    page = await pageAs(browser, 'A1', testInfo);
    await page.locator('#navKl').click();
    // Lúc mở màn hình không được nháy cảnh báo vàng: chỉ "Đang kết nối…" rồi "Cập nhật trực tiếp".
    await expect(page.locator('#klKetNoi')).not.toContainText('Mất kết nối');
    await expect(page.locator('#klBody tr[id^="klRow-"]').first()).toBeVisible(); // dữ liệu đã nạp xong (ô số đã có giá trị thật)
    await expect(page.locator('#klKetNoi')).toHaveText('Cập nhật trực tiếp', RT);
    // Chạy trên bản build (vite preview): lớp trong @layer components phải còn sau Tailwind — chấm xanh có màu ngọc.
    expect(await page.locator('#klKetNoi').evaluate((el) => globalThis.getComputedStyle(el, '::before').backgroundColor)).toBe('rgb(46, 125, 110)');
  });
  test.afterAll(async () => {
    await page?.context().close();
    if (db) await don(db);
  });

  // eslint-disable-next-line no-empty-pattern
  test('DB thêm một nhiệm vụ → dòng xuất hiện, không bấm gì', async ({}, testInfo) => {
    const { data: nv, error } = await db.from('nhiem_vu').insert({
      van_ban_id: hnId, nguoi_theo_doi: CV1_ID, noi_dung: `${E2E_TAG} realtime ${testInfo.project.name} ${Date.now()}`,
      loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
    }).select('id').single();
    if (error) throw new Error(error.message);
    // 2 worker (GĐ18): spec khác thêm/dọn việc cùng lúc nên không so ô Tổng/Hoàn thành theo số; chỉ kiểm dòng xuất hiện và đổi nhóm.
    await expect(page.locator(`#klRow-${nv.id}`)).toHaveAttribute('data-nhom', 'DANG_THUC_HIEN', RT);
    // DB đổi tiến độ (đủ minh chứng + ngày) → dòng đổi nhóm.
    const r = await db.from('nhiem_vu').update({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-09-01', minh_chung: 'CV 01 (e2e)' }).eq('id', nv.id).select('id');
    if (r.error) throw new Error(r.error.message);
    await expect(page.locator(`#klRow-${nv.id}`)).toHaveAttribute('data-nhom', 'HOAN_THANH', RT);
  });

  test('mất mạng → chỉ báo "làm mới mỗi 60 giây" trong ≤ 5 giây; có mạng lại → "Cập nhật trực tiếp"', async () => {
    await page.context().setOffline(true);
    await expect(page.locator('#klKetNoi')).toContainText('làm mới mỗi 60 giây', KN);
    expect(await page.locator('#klKetNoi').evaluate((el) => globalThis.getComputedStyle(el).color)).toBe('rgb(138, 101, 18)'); // chữ vàng --muc-vang trên bản build
    await page.context().setOffline(false);
    await expect(page.locator('#klKetNoi')).toHaveText('Cập nhật trực tiếp', { timeout: 60_000 }); // kênh mới mở lại khi có mạng; trên runner CI socket nối lại có thể theo backoff (~20–30 giây)
  });
});

async function don(db) {
  const { data } = await db.from('van_ban_giao_viec').select('id').eq('so_hoi_nghi', SO_HOI_NGHI);
  for (const h of data || []) {
    await db.from('nhiem_vu').delete().eq('van_ban_id', h.id);
    await db.from('van_ban_giao_viec').delete().eq('id', h.id);
  }
}
