// Kịch bản 12 (GĐ15 PR 15B): điều hành ngoại lệ — A1 mở Dashboard → dòng Đỏ (4 trường, sản phẩm "chưa định nghĩa", cấp
// "chưa xác định") → Chỉ đạo đôn đốc → A3 (người theo dõi) nhận chuông + toast realtime → mở nhiệm vụ từ toast, phản hồi
// → A1 thấy phản hồi realtime, đóng chỉ đạo → điền cấp cần quyết định tại chỗ → hết "chưa xác định". Kiểm màu/lớp trên
// bản build (Tailwind giữ lớp trong @layer components). Nhiệm vụ mẫu ở hội nghị 993 (E2E), Owner = phòng Tổng hợp, tự dọn.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';

const CV1_ID = '00000000-0000-4000-8000-000000000013'; // demo_e2e_dh — tài khoản riêng của spec (GĐ18)
const SO_HOI_NGHI = 993;
const RT = { timeout: 20_000 };   // realtime trên gói Free có thể trễ vài giây

test.describe.serial('Điều hành ngoại lệ — chỉ đạo, phản hồi, chuông, cấp quyết định', () => {
  let db; let nvId; let a1; let a3;

  test.beforeAll(async ({ browser }, testInfo) => {
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('v_ngoai_le').select('id').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có migration 0026 (điều hành ngoại lệ).');
    await don(db);
    // Chuông của A3 và A1 bắt đầu từ 0: xoá tin hệ thống cũ (dữ liệu giả của các lần chạy trước / test RLS trên staging).
    await db.from('direct_messages').delete().eq('receiver_id', CV1_ID).eq('loai', 'he_thong'); // chỉ chuông A3 (tài khoản riêng); tin của demo_cvp có spec khác dùng
    const { data: hn, error: e1 } = await db.from('van_ban_giao_viec').insert({ so_hoi_nghi: SO_HOI_NGHI, so_ket_luan: `${E2E_TAG}-DH`, ngay_ban_hanh: '2026-08-01' }).select('id').single();
    if (e1) throw new Error(`Tạo hội nghị mẫu thất bại: ${e1.message}`);
    const { data: nv, error: e2 } = await db.from('nhiem_vu').insert({
      van_ban_id: hn.id, nguoi_theo_doi: CV1_ID, noi_dung: `${E2E_TAG} ngoại lệ ${testInfo.project.name} ${Date.now()}`,
      loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-08-15', nganh_ma: 'KINH_TE_TONG_HOP', owner_don_vi_ma: 'TONG_HOP',
    }).select('id').single();
    if (e2) throw new Error(`Tạo nhiệm vụ mẫu thất bại: ${e2.message}`);
    nvId = nv.id;
    a1 = await pageAs(browser, 'A1', testInfo);
    a3 = await pageAs(browser, 'E2E_DH', testInfo);
  });
  test.afterAll(async () => {
    for (const p of [a1, a3]) await p?.context().close();
    if (db) await don(db);
  });

  test('Dashboard A1: dòng Đỏ đủ 4 trường; sản phẩm "chưa định nghĩa", cấp "chưa xác định"; màu đỏ trên bản build', async () => {
    const row = a1.locator(`#nlRow-${nvId}`);
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute('data-muc', 'DO_DAC_BIET');
    await expect(row).toContainText('Phòng Tổng hợp');
    await expect(row).toContainText('chưa định nghĩa');
    await expect(row.locator('.nl-cap')).toHaveValue('');
    await expect(row).toContainText('Demo E2E Chuyên viên DH');
    expect(Number(await row.locator('.nl-tre').innerText())).toBeGreaterThan(3);
    expect(await row.locator('.nl-tre').evaluate((el) => globalThis.getComputedStyle(el).color)).toBe('rgb(180, 35, 24)'); // --muc-do
    await expect(a3.locator('#chuongBadge')).toBeHidden();
    // 15E: hai nút riêng — "Chi tiết" mở ngăn với bảng thông tin mở sẵn, không đặt con trỏ; nút chính "Chỉ đạo" đậm hơn (bản build).
    expect(await row.locator('[data-action=moChiDaoNgoaiLe]').evaluate((el) => globalThis.getComputedStyle(el).fontWeight)).toBe('600');
    await row.locator('[data-action=moChiTietNgoaiLe]').click();
    await expect(a1.locator(`#klChiTiet-${nvId} .chi-tiet-them`)).toHaveAttribute('open', '');
    await expect(a1.locator(`#klChiDao-${nvId} .cd-form input[name=noi_dung]`)).not.toBeFocused();
    await a1.locator('#navKlDashboard').click();
    await expect(row).toBeVisible();
  });

  test('A1 bấm Chỉ đạo → đôn đốc; A3 nhận chuông + toast realtime, mở nhiệm vụ từ toast và phản hồi', async () => {
    await a1.locator(`#nlRow-${nvId} [data-action=moChiDaoNgoaiLe]`).click();
    await expect(a1.locator('#viewKl')).toBeVisible();
    const luong = a1.locator(`#klChiDao-${nvId}`);
    await expect(luong).toContainText('chưa có');
    await expect(luong.locator('.cd-form input[name=noi_dung]')).toBeFocused(); // 15C: mở thẳng vào ô nhập
    await expect(a1.locator(`#klChiTiet-${nvId} .chi-tiet-them`)).not.toHaveAttribute('open', ''); // bảng chi tiết gập
    await expect(a1.locator('#currentUserDisplay')).toBeInViewport(); // tên người dùng ở đầu thanh bên, không cần cuộn
    await luong.locator('.cd-form select[name=loai]').selectOption('DON_DOC');
    await luong.locator('.cd-form input[name=noi_dung]').fill('Khẩn trương hoàn thành trong tuần (e2e)');
    await luong.locator('.cd-form button[type=submit]').click();
    await expect(a1.locator(`#klChiDao-${nvId} .cd-goc`)).toHaveCount(1, RT);
    const goc = a1.locator(`#klChiDao-${nvId} .cd-goc`);
    await expect(goc).toContainText('Đôn đốc');
    await expect(goc).toHaveAttribute('data-trang-thai', 'CHO_PHAN_HOI');
    expect(await goc.evaluate((el) => globalThis.getComputedStyle(el).borderLeftColor)).toBe('rgb(138, 101, 18)'); // --muc-vang: chờ phản hồi

    // A3: toast + huy hiệu chuông (tin hệ thống cho người theo dõi).
    await expect(a3.locator('#realtimeToast')).toBeVisible(RT);
    await expect(a3.locator('#toastSender')).toHaveText('Thông báo trên nhiệm vụ');
    await expect(a3.locator('#toastContent')).toContainText('Đôn đốc · NV-');
    await expect(a3.locator('#chuongBadge')).toHaveText('1');
    await a3.locator('#toastActionBtn').click();
    const luongA3 = a3.locator(`#klChiDao-${nvId}`);
    await expect(luongA3.locator('.cd-goc')).toContainText('Khẩn trương hoàn thành trong tuần (e2e)');
    await expect(a3.locator('#chuongBadge')).toBeHidden();
    await expect(luongA3.locator('.cd-form')).toHaveCount(0); // A3 không có ô ra chỉ đạo
    await expect(luongA3.locator('.cd-form-ph')).toHaveClass(/cd-form-dau/); // ô phản hồi ở đầu khối, cùng vị trí ô gửi của A1
    await luongA3.locator('.cd-form-ph input[name=noi_dung]').fill('Đã trình dự thảo, chờ ký (e2e)');
    await luongA3.locator('.cd-form-ph button[type=submit]').click();
    await expect(luongA3.locator('.cd-ph')).toHaveCount(1, RT);
  });

  test('A1 thấy phản hồi realtime, đóng chỉ đạo; chuông A1 có tin phản hồi', async () => {
    const goc = a1.locator(`#klChiDao-${nvId} .cd-goc`);
    await expect(goc.locator('.cd-ph')).toContainText('Đã trình dự thảo, chờ ký (e2e)', RT);
    await expect(goc).toHaveAttribute('data-trang-thai', 'DA_PHAN_HOI');
    await expect(a1.locator(`#thongBaoList [data-nv="${nvId}"]`)).toHaveCount(1, RT); // đếm theo nhiệm vụ: spec chi-dao-tt (worker kia) cũng gửi tin cho demo_cvp
    await goc.locator('[data-action=dongChiDao]').click();
    await expect(a1.locator(`#klChiDao-${nvId} .cd-goc`)).toHaveAttribute('data-trang-thai', 'DA_DONG', RT);
    await expect(a1.locator(`#klChiDao-${nvId} .cd-form-ph`)).toHaveCount(0);
  });

  test('Điền cấp cần quyết định tại chỗ trên Dashboard → dòng không còn "chưa xác định", lịch sử ghi', async () => {
    await a1.locator('#navKlDashboard').click();
    const row = a1.locator(`#nlRow-${nvId}`);
    await expect(row).toBeVisible();
    const truoc = Number(await a1.locator('#klDbNgoaiLe .nl-tom-tat .bd-vang').innerText());
    await row.locator('.nl-cap').selectOption('CHANH_VAN_PHONG');
    await expect(a1.locator('#toastContainer')).toContainText('Đã xác định cấp cần quyết định');
    await expect(a1.locator(`#nlRow-${nvId} .nl-cap`)).toHaveValue('CHANH_VAN_PHONG', RT);
    await expect(a1.locator('#klDbNgoaiLe .nl-tom-tat .bd-vang')).toHaveText(String(truoc - 1), RT);
    const { data: ls } = await db.from('lich_su').select('cot, gia_tri_moi').eq('nhiem_vu_id', nvId).eq('cot', 'cap_quyet_dinh');
    expect(ls.map((l) => l.gia_tri_moi)).toEqual(['CHANH_VAN_PHONG']);
  });
});

async function don(db) {
  const { data } = await db.from('van_ban_giao_viec').select('id').eq('so_hoi_nghi', SO_HOI_NGHI);
  for (const h of data || []) {
    await db.from('nhiem_vu').delete().eq('van_ban_id', h.id); // chi_dao, lich_su, tin hệ thống xoá theo FK CASCADE
    await db.from('van_ban_giao_viec').delete().eq('id', h.id);
  }
}
